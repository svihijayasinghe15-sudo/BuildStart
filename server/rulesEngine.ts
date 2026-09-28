import { db } from './db.js';
import { computeSha256, computePerceptualSignature } from './hash.js';
import { extractSlipWithGemini } from './geminiExtraction.js';
import {
  Order,
  Submission,
  VerificationResult,
  StageOutcome,
  BankSMS,
  VerificationDecision,
} from '../src/types/payment.js';

export interface VerifySlipRequest {
  orderId: string;
  imageDataUri: string;
}

/**
 * Executes the 4-Stage Auto-Verification & Fraud Pipeline
 */
export async function executeVerificationPipeline(request: VerifySlipRequest): Promise<Submission> {
  const { orderId, imageDataUri } = request;
  const order = db.getOrderById(orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const submissionId = `SUB-${Date.now().toString().slice(-6)}`;
  const submittedAt = new Date().toISOString();
  const stages: StageOutcome[] = [];

  // ----------------------------------------------------
  // Stage 1: Zero-Cost SHA-256 Pre-Check
  // ----------------------------------------------------
  const stage1Start = performance.now();
  const imageHash = computeSha256(imageDataUri);
  const perceptualSig = computePerceptualSignature(imageDataUri);

  // Short-circuit if order is already settled
  if (order.status === 'APPROVED') {
    const stage1Duration = Math.round(performance.now() - stage1Start);
    stages.push({
      stage: 1,
      name: 'Zero-Cost Deduplication & State Check',
      status: 'FAILED',
      summary: `Order ${orderId} has already been approved and settled.`,
      executionTimeMs: stage1Duration,
      details: { imageHash, alreadySettled: true },
    });

    const result: VerificationResult = {
      submissionId,
      orderId,
      decision: 'REJECTED',
      confidenceScore: 100,
      rejectionCategory: 'DUPLICATE_IMAGE',
      rejectionReason: 'This order has already been finalized and approved.',
      customerMessage: 'This order is already marked as paid. If you need assistance, please contact support.',
      internalNote: 'Repeated slip upload blocked for already settled order.',
      stages,
      createdAt: submittedAt,
      imageHash,
      perceptualHash: perceptualSig,
    };

    const submission: Submission = {
      id: submissionId,
      orderId,
      imageUrl: imageDataUri,
      imageHash,
      status: 'REJECTED',
      verification: result,
      submittedAt,
    };

    db.saveSubmission(submission);
    db.addAuditLog(
      'Pipeline Stage 1',
      'REJECT_ALREADY_SETTLED',
      orderId,
      `Blocked slip upload for already settled order ${orderId}`,
      submissionId
    );
    return submission;
  }

  // Check duplicate image hash in registry
  const dupCheck = db.checkDuplicateHash(imageHash);
  if (dupCheck.isDuplicate) {
    const stage1Duration = Math.round(performance.now() - stage1Start);
    stages.push({
      stage: 1,
      name: 'Zero-Cost Deduplication & Pre-Check',
      status: 'FAILED',
      summary: `Duplicate image hash detected in deduplication registry. Previously verified on ${dupCheck.previous?.orderId}.`,
      executionTimeMs: stage1Duration,
      details: { imageHash, matchedOrderId: dupCheck.previous?.orderId, zeroAiCost: true },
    });

    // Skip stages 2, 3, 4
    stages.push(
      { stage: 2, name: 'Multimodal Extraction (Gemini)', status: 'SKIPPED', summary: 'Skipped: Deduplication pre-check failed (0 AI tokens spent)', executionTimeMs: 0, details: {} },
      { stage: 3, name: 'Fraud & Rule Engine', status: 'SKIPPED', summary: 'Skipped: Early exit at Stage 1', executionTimeMs: 0, details: {} },
      { stage: 4, name: 'Bank SMS Cross-Reconciliation', status: 'SKIPPED', summary: 'Skipped: Early exit at Stage 1', executionTimeMs: 0, details: {} }
    );

    const result: VerificationResult = {
      submissionId,
      orderId,
      decision: 'REJECTED',
      confidenceScore: 100,
      rejectionCategory: 'DUPLICATE_IMAGE',
      rejectionReason: `Exact image hash matches slip previously used for ${dupCheck.previous?.orderId}.`,
      customerMessage: 'This payment slip has already been submitted for another transaction. Please upload your unique transfer confirmation.',
      internalNote: `Fraud Alert: Reused slip image hash. Pre-check blocked processing with zero Gemini API overhead.`,
      stages,
      createdAt: submittedAt,
      imageHash,
      perceptualHash: perceptualSig,
    };

    const submission: Submission = {
      id: submissionId,
      orderId,
      imageUrl: imageDataUri,
      imageHash,
      status: 'REJECTED',
      verification: result,
      submittedAt,
    };

    db.saveSubmission(submission);
    db.addAuditLog(
      'Pipeline Stage 1',
      'REJECT_DUPLICATE_HASH',
      orderId,
      `Exact SHA-256 match found in registry (${imageHash.slice(0, 12)}...). 0 AI tokens consumed.`,
      submissionId
    );
    return submission;
  }

  // Stage 1 Passed
  const stage1Duration = Math.round(performance.now() - stage1Start);
  stages.push({
    stage: 1,
    name: 'Zero-Cost Deduplication & Pre-Check',
    status: 'PASSED',
    summary: 'Image hash is unique. No prior duplicate in database registry.',
    executionTimeMs: stage1Duration,
    details: { imageHash, zeroAiCost: true },
  });

  // ----------------------------------------------------
  // Stage 2: Multimodal Extraction (Gemini)
  // ----------------------------------------------------
  const stage2Start = performance.now();
  const extraction = await extractSlipWithGemini(imageDataUri, {
    orderAmount: order.amount,
    orderCurrency: order.currency,
    targetAccount: order.targetAccount,
  });
  const stage2Duration = Math.round(performance.now() - stage2Start);

  if (!extraction.isLegible || extraction.confidence < 0.35) {
    stages.push({
      stage: 2,
      name: 'Multimodal Extraction (Gemini)',
      status: 'FAILED',
      summary: 'Slip is unreadable or severely blurred. Low extraction confidence.',
      executionTimeMs: stage2Duration,
      details: { confidence: extraction.confidence, isLegible: extraction.isLegible, model: extraction.modelUsed },
    });
    stages.push(
      { stage: 3, name: 'Fraud & Rule Engine', status: 'SKIPPED', summary: 'Skipped: OCR data unreadable', executionTimeMs: 0, details: {} },
      { stage: 4, name: 'Bank SMS Cross-Reconciliation', status: 'SKIPPED', summary: 'Skipped: OCR data unreadable', executionTimeMs: 0, details: {} }
    );

    const result: VerificationResult = {
      submissionId,
      orderId,
      decision: 'REJECTED',
      confidenceScore: Math.round(extraction.confidence * 100),
      rejectionCategory: 'ILLEGIBLE_SLIP',
      rejectionReason: 'Slip is illegible or optical blur exceeds threshold.',
      customerMessage: 'We could not clearly read the details on your payment slip. Please upload a clear, focused photo or screenshot.',
      internalNote: `Gemini OCR flagged slip as illegible (Confidence: ${Math.round(extraction.confidence * 100)}%).`,
      stages,
      extraction,
      createdAt: submittedAt,
      imageHash,
      perceptualHash: perceptualSig,
    };

    const submission: Submission = {
      id: submissionId,
      orderId,
      imageUrl: imageDataUri,
      imageHash,
      status: 'REJECTED',
      verification: result,
      submittedAt,
    };

    db.saveSubmission(submission);
    db.addAuditLog('Pipeline Stage 2', 'REJECT_ILLEGIBLE', orderId, 'Extraction failed due to blur or illegibility.', submissionId);
    return submission;
  }

  stages.push({
    stage: 2,
    name: 'Multimodal Extraction (Gemini)',
    status: 'PASSED',
    summary: `Extracted ${extraction.amount} ${extraction.currency} from ${extraction.bankName}. Ref: ${extraction.referenceNumber}. Tamper score: ${(extraction.tamperScore * 100).toFixed(0)}%.`,
    executionTimeMs: stage2Duration,
    details: {
      amount: extraction.amount,
      currency: extraction.currency,
      ref: extraction.referenceNumber,
      tamperScore: extraction.tamperScore,
      model: extraction.modelUsed,
    },
  });

  // ----------------------------------------------------
  // Stage 3: Fraud & Rule Engine
  // ----------------------------------------------------
  const stage3Start = performance.now();
  let stage3Passed = true;
  let stage3FailureReason = '';
  let stage3Category: VerificationResult['rejectionCategory'] | undefined;
  let customerMsg = '';
  let internalNote = '';

  // 3.1 Digital Tamper Check
  if (extraction.tamperScore >= db.merchantConfig.tamperScoreThreshold) {
    stage3Passed = false;
    stage3Category = 'TAMPERED_SLIP';
    stage3FailureReason = `Forensic anomaly: Suspected digital manipulation (Score: ${(extraction.tamperScore * 100).toFixed(0)}%).`;
    customerMsg = 'Document verification failed: Visual inconsistencies or digital alterations detected on the payment slip. Please upload an original receipt.';
    internalNote = `Tamper Alert: Reasons: ${extraction.tamperReasons.join(', ') || 'Font / pixel border artifacts'}`;
  }

  // 3.2 Receiving Account Check
  if (stage3Passed) {
    const slipAccClean = extraction.recipientAccount.replace(/[\s\-\.]/g, '');
    const merchantAccClean = order.targetAccount.replace(/[\s\-\.]/g, '');
    const slipSuffix = slipAccClean.slice(-4);
    const merchantSuffix = merchantAccClean.slice(-4);

    const isMatch =
      slipAccClean === merchantAccClean ||
      (slipSuffix.length === 4 && merchantSuffix.length === 4 && slipSuffix === merchantSuffix) ||
      db.merchantConfig.authorizedAccounts.some(
        (a) => a.accountNumber.replace(/[\s\-\.]/g, '') === slipAccClean || a.accountSuffix === slipSuffix
      );

    if (!isMatch) {
      stage3Passed = false;
      stage3Category = 'ACCOUNT_MISMATCH';
      stage3FailureReason = `Recipient account mismatch. Slip sent to ...${slipSuffix || slipAccClean}, expected ...${merchantSuffix}.`;
      customerMsg = `The transfer was sent to an unrecognized receiving account (...${slipSuffix || 'unknown'}), which does not match our merchant account.`;
      internalNote = `Wrong recipient account: Slip specifies '${extraction.recipientAccount}', merchant expects '${order.targetAccount}'.`;
    }
  }

  // 3.3 Amount Match
  if (stage3Passed) {
    const diff = Math.abs(extraction.amount - order.amount);
    const isAmountValid = db.merchantConfig.allowMinorCentsRounding ? diff < 0.1 : diff < 0.01;

    if (!isAmountValid) {
      stage3Passed = false;
      stage3Category = 'AMOUNT_MISMATCH';
      stage3FailureReason = `Amount mismatch: Slip shows ${extraction.amount} ${extraction.currency}, order total is ${order.amount} ${order.currency}.`;
      customerMsg = `The transfer amount of ${extraction.amount.toFixed(2)} ${extraction.currency} does not match the required total of ${order.amount.toFixed(2)} ${order.currency}.`;
      internalNote = `Under/Over payment detected. Slip: ${extraction.amount}, Order: ${order.amount}, Diff: ${(extraction.amount - order.amount).toFixed(2)}`;
    }
  }

  // 3.4 Reused Reference Check
  if (stage3Passed) {
    const refCheck = db.checkDuplicateReference(extraction.referenceNumber, order.id);
    if (refCheck.isDuplicate) {
      stage3Passed = false;
      stage3Category = 'REUSED_REFERENCE';
      stage3FailureReason = `Reference number #${extraction.referenceNumber} has already been registered on order ${refCheck.previous?.orderId}.`;
      customerMsg = `Transaction reference #${extraction.referenceNumber} has already been recorded in our system. Please check your bank transaction.`;
      internalNote = `Fraud flag: Reference code collision with existing order ${refCheck.previous?.orderId}.`;
    }
  }

  // 3.5 Stale / Future Date Check
  if (stage3Passed) {
    const slipDate = new Date(extraction.transferDateTime);
    const orderDate = new Date(order.createdAt);
    if (!isNaN(slipDate.getTime())) {
      const minutesDiff = (orderDate.getTime() - slipDate.getTime()) / (1000 * 60);
      // If slip is older than allowed stale window (e.g. 24 hours prior to order)
      if (minutesDiff > db.merchantConfig.staleMinutesThreshold) {
        stage3Passed = false;
        stage3Category = 'STALE_DATE';
        stage3FailureReason = `Transaction date (${slipDate.toLocaleDateString()}) is stale compared to order date (${orderDate.toLocaleDateString()}).`;
        customerMsg = 'The payment slip timestamp predates this order by over 24 hours. Please submit a current transfer receipt.';
        internalNote = `Stale slip: Transfer timestamp is ${Math.round(minutesDiff / 60)} hours older than order.`;
      }
    }
  }

  const stage3Duration = Math.round(performance.now() - stage3Start);

  if (!stage3Passed) {
    stages.push({
      stage: 3,
      name: 'Fraud & Rule Engine',
      status: 'FAILED',
      summary: stage3FailureReason,
      executionTimeMs: stage3Duration,
      details: {
        category: stage3Category,
        tamperScore: extraction.tamperScore,
        amount: extraction.amount,
        expectedAmount: order.amount,
        ref: extraction.referenceNumber,
      },
    });
    stages.push({
      stage: 4,
      name: 'Bank SMS Cross-Reconciliation',
      status: 'SKIPPED',
      summary: 'Skipped: Fraud rules failed in Stage 3',
      executionTimeMs: 0,
      details: {},
    });

    const result: VerificationResult = {
      submissionId,
      orderId,
      decision: 'REJECTED',
      confidenceScore: 95,
      rejectionCategory: stage3Category,
      rejectionReason: stage3FailureReason,
      customerMessage: customerMsg,
      internalNote,
      stages,
      extraction,
      createdAt: submittedAt,
      imageHash,
      perceptualHash: perceptualSig,
    };

    const submission: Submission = {
      id: submissionId,
      orderId,
      imageUrl: imageDataUri,
      imageHash,
      status: 'REJECTED',
      verification: result,
      submittedAt,
    };

    db.saveSubmission(submission);
    db.addAuditLog('Pipeline Stage 3', `REJECT_${stage3Category}`, orderId, stage3FailureReason, submissionId);
    return submission;
  }

  // Stage 3 Passed
  stages.push({
    stage: 3,
    name: 'Fraud & Rule Engine',
    status: 'PASSED',
    summary: 'All fraud rules passed: Authenticity confirmed, amount & recipient account matched, reference code unique.',
    executionTimeMs: stage3Duration,
    details: {
      tamperScore: extraction.tamperScore,
      amountMatched: true,
      accountMatched: true,
      refUnique: true,
    },
  });

  // ----------------------------------------------------
  // Stage 4: Bank SMS Cross-Reconciliation
  // ----------------------------------------------------
  const stage4Start = performance.now();
  const targetAccountClean = order.targetAccount.replace(/[\s\-\.]/g, '');
  const targetSuffix = targetAccountClean.slice(-4);

  const smsMatchResult = db.findMatchingSms(
    order.amount,
    order.currency,
    targetSuffix,
    extraction.referenceNumber,
    order.id
  );

  const stage4Duration = Math.round(performance.now() - stage4Start);

  let decision: VerificationDecision = 'APPROVED';
  let matchedSms: BankSMS | undefined = undefined;

  if (smsMatchResult.conflictReason) {
    // There is an SMS conflict (e.g. claimed already)
    decision = 'REJECTED';
    stages.push({
      stage: 4,
      name: 'Bank SMS Cross-Reconciliation',
      status: 'FAILED',
      summary: smsMatchResult.conflictReason,
      executionTimeMs: stage4Duration,
      details: { conflict: smsMatchResult.conflictReason },
    });

    const result: VerificationResult = {
      submissionId,
      orderId,
      decision: 'REJECTED',
      confidenceScore: 98,
      rejectionCategory: 'CLAIM_CONFLICT',
      rejectionReason: smsMatchResult.conflictReason,
      customerMessage: 'Bank deposit record conflict detected. Please reach out to customer support with your transaction details.',
      internalNote: `Fraud conflict: ${smsMatchResult.conflictReason}`,
      stages,
      extraction,
      createdAt: submittedAt,
      imageHash,
      perceptualHash: perceptualSig,
    };

    const submission: Submission = {
      id: submissionId,
      orderId,
      imageUrl: imageDataUri,
      imageHash,
      status: 'REJECTED',
      verification: result,
      submittedAt,
    };

    db.saveSubmission(submission);
    db.addAuditLog('Pipeline Stage 4', 'REJECT_SMS_CONFLICT', orderId, smsMatchResult.conflictReason, submissionId);
    return submission;
  }

  if (smsMatchResult.matched) {
    // Direct bank SMS match found!
    matchedSms = smsMatchResult.matched;
    db.claimBankSms(matchedSms.id, order.id, submissionId);

    stages.push({
      stage: 4,
      name: 'Bank SMS Cross-Reconciliation',
      status: 'PASSED',
      summary: `Matched with Bank SMS ${matchedSms.id} (${matchedSms.sender}) for ${matchedSms.parsedAmount} ${matchedSms.parsedCurrency}. Claim recorded.`,
      executionTimeMs: stage4Duration,
      details: {
        smsId: matchedSms.id,
        sender: matchedSms.sender,
        amount: matchedSms.parsedAmount,
        ref: matchedSms.parsedRef,
      },
    });

    const result: VerificationResult = {
      submissionId,
      orderId,
      decision: 'APPROVED',
      confidenceScore: 99,
      customerMessage: 'Payment verified successfully against live bank settlement records. Your order is confirmed!',
      internalNote: `Fully verified across all 4 stages. Linked to SMS ID ${matchedSms.id}.`,
      stages,
      extraction,
      matchedSmsId: matchedSms.id,
      matchedSms,
      createdAt: submittedAt,
      imageHash,
      perceptualHash: perceptualSig,
    };

    const submission: Submission = {
      id: submissionId,
      orderId,
      imageUrl: imageDataUri,
      imageHash,
      status: 'APPROVED',
      verification: result,
      submittedAt,
    };

    db.saveSubmission(submission);
    db.updateOrder(order.id, {
      status: 'APPROVED',
      settledAt: submittedAt,
      submissionId,
    });

    db.addAuditLog(
      'Pipeline Stage 4',
      'AUTO_APPROVED',
      orderId,
      `Order auto-approved. Reconciled with SMS ${matchedSms.id} (${matchedSms.parsedAmount} ${matchedSms.parsedCurrency}).`,
      submissionId
    );
    return submission;
  }

  // If no matching SMS is in the feed yet, but Stages 1-3 were completely valid:
  // It enters "NEEDS_VERIFICATION" (awaiting bank feed confirmation)
  decision = 'NEEDS_VERIFICATION';
  stages.push({
    stage: 4,
    name: 'Bank SMS Cross-Reconciliation',
    status: 'PENDING',
    summary: 'Slip valid. Pending credit confirmation in bank SMS feed.',
    executionTimeMs: stage4Duration,
    details: {
      waitingForSms: true,
      expectedAmount: order.amount,
      targetAccountSuffix: targetSuffix,
    },
  });

  const result: VerificationResult = {
    submissionId,
    orderId,
    decision: 'NEEDS_VERIFICATION',
    confidenceScore: 82,
    customerMessage: 'Payment slip parsed and verified. We are awaiting confirmation from the bank settlement feed; your order will update shortly.',
    internalNote: 'Slip passed Stages 1, 2, and 3. No matching Bank SMS found in current feed. Queued for live auto-reconciliation or staff manual review.',
    stages,
    extraction,
    createdAt: submittedAt,
    imageHash,
    perceptualHash: perceptualSig,
  };

  const submission: Submission = {
    id: submissionId,
    orderId,
    imageUrl: imageDataUri,
    imageHash,
    status: 'NEEDS_VERIFICATION',
    verification: result,
    submittedAt,
  };

  db.saveSubmission(submission);
  db.updateOrder(order.id, {
    status: 'NEEDS_VERIFICATION',
    submissionId,
  });

  db.addAuditLog(
    'Pipeline Stage 4',
    'STATUS_NEEDS_VERIFICATION',
    orderId,
    'Slip verified. Awaiting bank SMS feed credit or manual staff override.',
    submissionId
  );

  return submission;
}

/**
 * Triggered when a new Bank SMS is ingested or simulated.
 * Scans all pending submissions with 'NEEDS_VERIFICATION' and attempts auto-reconciliation.
 */
export function reconcilePendingOrdersWithNewSms(newSms: BankSMS): Array<{ orderId: string; submissionId: string }> {
  const reconciled: Array<{ orderId: string; submissionId: string }> = [];
  const submissions = db.getSubmissions().filter((s) => s.status === 'NEEDS_VERIFICATION');

  for (const sub of submissions) {
    const order = db.getOrderById(sub.orderId);
    if (!order || order.status !== 'NEEDS_VERIFICATION') continue;

    const targetAccountClean = order.targetAccount.replace(/[\s\-\.]/g, '');
    const targetSuffix = targetAccountClean.slice(-4);
    const slipRef = sub.verification.extraction?.referenceNumber;

    // Check if newSms matches this order
    const isAmountMatch = Math.abs(newSms.parsedAmount - order.amount) < 0.01;
    const isAccMatch =
      !newSms.parsedAccountSuffix ||
      newSms.parsedAccountSuffix === targetSuffix ||
      targetSuffix.endsWith(newSms.parsedAccountSuffix);
    const isRefMatch =
      slipRef && newSms.parsedRef && slipRef.toLowerCase() === newSms.parsedRef.toLowerCase();

    if (isAmountMatch && (isAccMatch || isRefMatch)) {
      // Claim SMS
      const claimed = db.claimBankSms(newSms.id, order.id, sub.id);
      if (!claimed) continue;

      // Update submission
      sub.status = 'APPROVED';
      sub.verification.decision = 'APPROVED';
      sub.verification.confidenceScore = 99;
      sub.verification.matchedSmsId = newSms.id;
      sub.verification.matchedSms = newSms;
      sub.verification.customerMessage = 'Payment confirmed! Bank SMS credit notification received and matched.';
      sub.verification.internalNote = `Auto-reconciled on arrival of Bank SMS ${newSms.id}. Order marked APPROVED.`;

      // Update Stage 4 outcome
      const stage4 = sub.verification.stages.find((s) => s.stage === 4);
      if (stage4) {
        stage4.status = 'PASSED';
        stage4.summary = `Reconciled upon arrival of Bank SMS ${newSms.id} (${newSms.sender}). Claim recorded.`;
        stage4.details = {
          smsId: newSms.id,
          sender: newSms.sender,
          amount: newSms.parsedAmount,
          ref: newSms.parsedRef,
          autoReconciled: true,
        };
      }

      db.saveSubmission(sub);
      db.updateOrder(order.id, {
        status: 'APPROVED',
        settledAt: new Date().toISOString(),
      });

      db.addAuditLog(
        'Auto-Reconciliation Engine',
        'SMS_TRIGGERED_APPROVAL',
        order.id,
        `Pending order ${order.id} automatically resolved to APPROVED via incoming SMS ${newSms.id}`,
        sub.id
      );

      reconciled.push({ orderId: order.id, submissionId: sub.id });
      break; // Each SMS can claim at most one order
    }
  }

  return reconciled;
}
