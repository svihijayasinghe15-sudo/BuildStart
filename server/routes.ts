import { Router, Request, Response } from 'express';
import { db } from './db.js';
import { executeVerificationPipeline, reconcilePendingOrdersWithNewSms } from './rulesEngine.js';
import { getTestScenarios } from './scenarios.js';

export const apiRouter = Router();

// Orders
apiRouter.get('/orders', (req: Request, res: Response) => {
  res.json({ success: true, data: db.getOrders() });
});

apiRouter.get('/orders/:id', (req: Request, res: Response) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  res.json({ success: true, data: order });
});

// Verification Pipeline execution
apiRouter.post('/verify-slip', async (req: Request, res: Response) => {
  try {
    const { orderId, imageDataUri } = req.body;
    if (!orderId || !imageDataUri) {
      return res.status(400).json({ success: false, error: 'Missing orderId or imageDataUri' });
    }

    const submission = await executeVerificationPipeline({ orderId, imageDataUri });
    res.json({ success: true, data: submission });
  } catch (error: any) {
    console.error('Error executing verification pipeline:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal verification error' });
  }
});

// Submissions
apiRouter.get('/submissions', (req: Request, res: Response) => {
  const { status, orderId } = req.query;
  let items = db.getSubmissions();

  if (status && typeof status === 'string' && status !== 'ALL') {
    items = items.filter((s) => s.status === status);
  }
  if (orderId && typeof orderId === 'string') {
    items = items.filter((s) => s.orderId === orderId);
  }

  res.json({ success: true, data: items });
});

apiRouter.get('/submissions/:id', (req: Request, res: Response) => {
  const submission = db.getSubmissionById(req.params.id);
  if (!submission) {
    return res.status(404).json({ success: false, error: 'Submission not found' });
  }
  res.json({ success: true, data: submission });
});

// Manual Staff Override
apiRouter.post('/submissions/:id/override', (req: Request, res: Response) => {
  const { staffName, newStatus, reason } = req.body;
  if (!staffName || !newStatus || !reason) {
    return res.status(400).json({ success: false, error: 'staffName, newStatus, and reason are required' });
  }

  const submission = db.getSubmissionById(req.params.id);
  if (!submission) {
    return res.status(404).json({ success: false, error: 'Submission not found' });
  }

  const prevStatus = submission.status;
  submission.status = newStatus;
  submission.verification.decision = newStatus;
  submission.manualOverride = {
    overriddenBy: staffName,
    overriddenAt: new Date().toISOString(),
    previousStatus: prevStatus,
    newStatus,
    reason,
  };

  db.saveSubmission(submission);

  // Update order status accordingly
  db.updateOrder(submission.orderId, {
    status: newStatus,
    settledAt: newStatus === 'APPROVED' ? new Date().toISOString() : undefined,
  });

  db.addAuditLog(
    staffName,
    'MANUAL_OVERRIDE',
    submission.orderId,
    `Status modified from ${prevStatus} to ${newStatus}. Reason: ${reason}`,
    submission.id
  );

  res.json({ success: true, data: submission });
});

// Bank SMS Feed
apiRouter.get('/sms-feed', (req: Request, res: Response) => {
  res.json({ success: true, data: db.getBankSmsFeed() });
});

// Simulate incoming Bank SMS
apiRouter.post('/simulate-sms', (req: Request, res: Response) => {
  const { rawText, sender = 'SCB-ALERT' } = req.body;
  if (!rawText) {
    return res.status(400).json({ success: false, error: 'rawText is required' });
  }

  const newSms = db.addBankSms(rawText, sender);

  // Attempt to auto-reconcile any pending orders waiting for verification
  const autoReconciled = reconcilePendingOrdersWithNewSms(newSms);

  res.json({
    success: true,
    data: {
      sms: newSms,
      autoReconciled,
    },
  });
});

// Audit Logs
apiRouter.get('/audit-logs', (req: Request, res: Response) => {
  res.json({ success: true, data: db.getAuditLogs() });
});

// Merchant Config
apiRouter.get('/merchant-config', (req: Request, res: Response) => {
  res.json({ success: true, data: db.merchantConfig });
});

apiRouter.post('/merchant-config', (req: Request, res: Response) => {
  const updates = req.body;
  db.merchantConfig = { ...db.merchantConfig, ...updates };
  db.addAuditLog('Admin', 'CONFIG_UPDATE', 'MERCHANT', 'Updated verification parameters');
  res.json({ success: true, data: db.merchantConfig });
});

// Scenarios Test Bench
apiRouter.get('/scenarios', (req: Request, res: Response) => {
  res.json({ success: true, data: getTestScenarios() });
});

// Reset data back to default initial state
apiRouter.post('/reset-data', (req: Request, res: Response) => {
  db.seedDefaults();
  res.json({ success: true, message: 'Database reset to initial state' });
});
