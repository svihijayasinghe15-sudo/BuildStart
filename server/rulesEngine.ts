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
  RejectionCategory,
} from '../src/types/payment.js';

export interface VerifySlipRequest {
  orderId: string;
  imageDataUri: string;
}

/**
 * Executes the 4-Stage Auto-Verification & Fraud Pipeline
 * Covers all 12 operational scenarios:
 * 1. Normal payment
 * 2. Wrong amount (under/over)
 * 3. Wrong account
 * 4. Duplicate payment (exact image)
 * 5. Reused payment (another customer)
 * 6. Same payment, different image (different crop/screenshot)
 * 7. Old payment (stale date)
 * 8. Edited or suspicious slip (tamper)
 * 9. Unclear image (blurry/dark)
 * 10. Conflicting evidence (slip contradicts bank feed)
 * 11. Missing evidence (no bank settlement yet)
 * 12. Multiple customers with similar payments (anti-false-attribution)
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
      name: 'Zero-Cost Deduplication & Pre-Check',
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
      rejectionCategory: 'DUPLICATE_PAYMENT',
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

  // Check 1: Duplicate payment (Exact same slip submitted more than once)
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
      rejectionCategory: 'DUPLICATE_PAYMENT',
      rejectionReason: `Exact image hash matches slip previously used for ${dupCheck.previous?.orderId}.`,
      customerMessage: 'This payment slip has already been submitted for another transaction. Please upload your unique transfer confirmation.',
      internalNote: `Duplicate payment alert: Reused exact slip image hash. Pre-check blocked processing with zero Gemini API overhead.`,
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
      'REJECT_DUPLICATE_PAYMENT',
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
  // Stage 2: Multimodal Extraction (Gemini 3.8 Flash)
  // ----------------------------------------------------
  const stage2Start = performance.now();
  const extraction = await extractSlipWithGemini(imageDataUri, {
    orderAmount: order.amount,
    orderCurrency: order.currency,
    targetAccount: order.targetAccount,
  });
  const stage2Duration = Math.round(performance.now() - stage2Start);

  // Check 9: Unclear image (Blurry, cropped, dark, or low-resolution)
  // NOTE: In banking operations, an unclear image is UNCERTAINTY, not malice.
  // We classify as NEEDS_VERIFICATION with an actionable customer resubmission prompt!
  if (!extraction.isLegible || extraction.confidence < 0.40 || extraction.isCroppedOrDark) {
    stages.push({
      stage: 2,
      name: 'Multimodal Extraction (Gemini)',
      status: 'PENDING',
      summary: 'Slip is unreadable, dark, or severely blurred. Low extraction confidence.',
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
      decision: 'NEEDS_VERIFICATION',
      confidenceScore: Math.round(extraction.confidence * 100),
      rejectionCategory: 'UNCLEAR_IMAGE',
      rejectionReason: 'Slip is blurry, dark, cropped, or optical quality is insufficient for verification.',
      customerMessage: 'The photo of your payment slip appears blurry, dark, or cropped. Please upload a clear, focused screenshot directly from your mobile banking app.',
      internalNote: `Image quality check: Gemini OCR confidence (${Math.round(extraction.confidence * 100)}%) below threshold. Queued for clearer resubmission.`,
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
    db.updateOrder(order.id, { status: 'NEEDS_VERIFICATION', submissionId });
    db.addAuditLog('Pipeline Stage 2', 'UNCLEAR_IMAGE_REQUEST_RESUBMIT', orderId, 'Extraction low confidence due to blur/lighting.', submissionId);
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
  let stage3Category: RejectionCategory | undefined;
  let customerMsg = '';
  let internalNote = '';

  // Check 8: Edited or suspicious slip (Manipulated amount, date, reference, or accounts)
  if (extraction.tamperScore >= db.merchantConfig.tamperScoreThreshold) {
    stage3Passed = false;
    stage3Category = 'EDITED_SLIP';
    stage3FailureReason = `Forensic anomaly: Suspected digital manipulation (Score: ${(extraction.tamperScore * 100).toFixed(0)}%).`;
    customerMsg = 'Document verification failed: Visual inconsistencies or digital alterations detected on the payment slip. Please upload an original receipt.';
    internalNote = `Edited / Suspicious Slip Alert: ${extraction.tamperReasons.join(', ') || 'Font kerning or pixel border artifacts'}`;
  }

  // Check 3: Wrong account (Payment made to an account that does not belong to the business)
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
      stage3Category = 'WRONG_ACCOUNT';
      stage3FailureReason = `Wrong recipient account. Slip sent to ...${slipSuffix || slipAccClean}, expected business account ...${merchantSuffix}.`;
      customerMsg = `The payment was made to an account (...${slipSuffix || 'unknown'}) that does not belong to our business. Please verify the beneficiary details.`;
      internalNote = `Wrong Account: Slip specifies recipient '${extraction.recipientAccount}', merchant expects '${order.targetAccount}'.`;
    }
  }

  // Check 2: Wrong amount (The customer paid less or more than the required amount)
  if (stage3Passed) {
    const diff = Math.abs(extraction.amount - order.amount);
    const isAmountValid = db.merchantConfig.allowMinorCentsRounding ? diff < 0.1 : diff < 0.01;

    if (!isAmountValid) {
      stage3Passed = false;
      stage3Category = 'WRONG_AMOUNT';
      const isUnderpayment = extraction.amount < order.amount;
      const delta = Math.abs(order.amount - extraction.amount);

      if (isUnderpayment) {
        stage3FailureReason = `Underpayment: Slip shows ${extraction.amount.toFixed(2)} ${extraction.currency}, required order total is ${order.amount.toFixed(2)} ${order.currency}. Shortfall: ${delta.toFixed(2)} ${order.currency}.`;
        customerMsg = `Underpayment detected: You paid ${extraction.amount.toFixed(2)} ${extraction.currency}, but the order total is ${order.amount.toFixed(2)} ${order.currency}. Please settle the remaining ${delta.toFixed(2)} ${order.currency}.`;
      } else {
        stage3FailureReason = `Overpayment: Slip shows ${extraction.amount.toFixed(2)} ${extraction.currency}, required order total is ${order.amount.toFixed(2)} ${order.currency}. Excess: ${delta.toFixed(2)} ${order.currency}.`;
        customerMsg = `Overpayment detected: You transferred ${extraction.amount.toFixed(2)} ${extraction.currency}, which exceeds the required order total of ${order.amount.toFixed(2)} ${order.currency}. Please contact support for assistance.`;
      }
      internalNote = `Amount Mismatch: Slip ${extraction.amount}, Order ${order.amount}, Delta: ${(extraction.amount - order.amount).toFixed(2)}`;
    }
  }

  // Check 6 & 5: Same payment, different image VS Reused payment
  if (stage3Passed) {
    const refUsage = db.checkReferenceUsage(extraction.referenceNumber, order.id, imageHash);
    if (refUsage.isClaimed && refUsage.previous) {
      stage3Passed = false;

      if (refUsage.isReusedPayment) {
        // Check 5: Reused payment (A genuine payment is submitted for another customer's order)
        stage3Category = 'REUSED_PAYMENT';
        stage3FailureReason = `Reused payment: Transaction reference #${extraction.referenceNumber} was already credited to order ${refUsage.previous.orderId}.`;
        customerMsg = `This payment transaction (Ref #${extraction.referenceNumber}) has already been credited to another customer's order. Each transfer can only be used once.`;
        internalNote = `Reused payment alert: Customer submitted genuine payment previously claimed by order ${refUsage.previous.orderId}.`;
      } else if (refUsage.isSamePaymentDifferentImage) {
        // Check 6: Same payment, different image (The same transaction is submitted as different screenshots/photos/crops)
        stage3Category = 'SAME_PAYMENT_DIFFERENT_IMAGE';
        stage3FailureReason = `Same transaction submitted as a different image/crop. Reference #${extraction.referenceNumber} was already recorded under hash ${refUsage.previous.imageHash.slice(0, 8)}...`;
        customerMsg = `This transaction (Reference #${extraction.referenceNumber}) has already been processed using a different receipt image.`;
        internalNote = `Same payment different image: SHA-256 differed due to cropping/recapture, but transaction reference #${extraction.referenceNumber} collision confirmed.`;
      }
    }
  }

  // Check 7: Old payment (A genuine payment from a previous transaction is submitted for a new order)
  if (stage3Passed) {
    const slipDate = new Date(extraction.transferDateTime);
    const orderDate = new Date(order.createdAt);
    if (!isNaN(slipDate.getTime())) {
      const hoursDiff = (orderDate.getTime() - slipDate.getTime()) / (1000 * 60 * 60);
      // If slip timestamp is older than merchant configured window (e.g., > 24 hours prior)
      if (hoursDiff > db.merchantConfig.staleMinutesThreshold / 60) {
        stage3Passed = false;
        stage3Category = 'OLD_PAYMENT';
        stage3FailureReason = `Old payment: Transaction date (${slipDate.toLocaleDateString()}) predates order (${orderDate.toLocaleDateString()}) by ${Math.round(hoursDiff)} hours.`;
        customerMsg = `The payment receipt is from a past transaction dated ${slipDate.toLocaleDateString()}, but this order was placed on ${orderDate.toLocaleDateString()}. Please submit a current transfer receipt.`;
        internalNote = `Old payment alert: Transfer timestamp is ${Math.round(hoursDiff)} hours older than order creation.`;
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

  // Check 10: Conflicting evidence (Slip extracted details contradict bank SMS feed)
  const conflictCheck = db.findConflictingEvidence(
    extraction.referenceNumber,
    extraction.amount,
    extraction.currency
  );
  if (conflictCheck.hasConflict) {
    const stage4Duration = Math.round(performance.now() - stage4Start);
    stages.push({
      stage: 4,
      name: 'Bank SMS Cross-Reconciliation',
      status: 'FAILED',
      summary: conflictCheck.reason || 'Conflicting evidence between slip and bank settlement data.',
      executionTimeMs: stage4Duration,
      details: { conflict: conflictCheck.reason },
    });

    const result: VerificationResult = {
      submissionId,
      orderId,
      decision: 'REJECTED',
      confidenceScore: 98,
      rejectionCategory: 'CONFLICTING_EVIDENCE',
      rejectionReason: conflictCheck.reason,
      customerMessage: 'Information extracted from your payment slip directly conflicts with our bank settlement records. Please contact billing support.',
      internalNote: `Conflicting Evidence: ${conflictCheck.reason}`,
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
    db.addAuditLog('Pipeline Stage 4', 'REJECT_CONFLICTING_EVIDENCE', orderId, conflictCheck.reason || '', submissionId);
    return submission;
  }

  // Check 12: Multiple customers with similar payments & Anti-False-Attribution
  const smsMatchResult = db.findMatchingSms(
    order.amount,
    order.currency,
    targetSuffix,
    extraction.referenceNumber,
    order.id,
    order.customerName || extraction.senderName
  );

  const stage4Duration = Math.round(performance.now() - stage4Start);

  // Case 12: Multiple customers with similar payments (Avoid assuming matching amount alone proves ownership!)
  if (smsMatchResult.isAmbiguous) {
    stages.push({
      stage: 4,
      name: 'Bank SMS Cross-Reconciliation',
      status: 'PENDING',
      summary: `Ambiguous Payment: Multiple concurrent customers expecting ${order.amount} ${order.currency}. Matching amounts alone cannot prove ownership.`,
      executionTimeMs: stage4Duration,
      details: {
        competingOrders: smsMatchResult.competingOrders,
        antiFalseAttributionTriggered: true,
      },
    });

    const result: VerificationResult = {
      submissionId,
      orderId,
      decision: 'NEEDS_VERIFICATION',
      confidenceScore: 68,
      rejectionCategory: 'AMBIGUOUS_SIMILAR_PAYMENTS',
      rejectionReason: `Multiple customers placed identical orders for ${order.amount} ${order.currency}. Reference or sender disambiguation required.`,
      customerMessage: 'We detected multiple identical payments around this time. For your security, our team is verifying your specific transaction reference before activating your order.',
      internalNote: `Multi-Customer Ambiguity: Orders (${smsMatchResult.competingOrders?.join(', ')}) share identical ${order.amount} ${order.currency}. Bank SMS lacks unique reference or sender match; auto-attribution blocked to prevent wrongful credit.`,
      stages,
      extraction,
      createdAt: submittedAt,
      imageHash,
      perceptualHash: perceptualSig,
      disambiguationRequired: true,
      competingOrders: smsMatchResult.competingOrders,
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
    db.updateOrder(order.id, { status: 'NEEDS_VERIFICATION', submissionId });
    db.addAuditLog('Pipeline Stage 4', 'AMBIGUOUS_SIMILAR_PAYMENTS', orderId, 'Amount-only match blocked due to concurrent identical customer orders.', submissionId);
    return submission;
  }

  // Already claimed by another order conflict
  if (smsMatchResult.conflictReason) {
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

  // Check 1: Normal payment (A genuine payment with matching information)
  if (smsMatchResult.matched) {
    const matchedSms = smsMatchResult.matched;
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
      rejectionCategory: 'NORMAL_PAYMENT',
      customerMessage: 'Payment verified successfully against live bank settlement records. Your order is confirmed!',
      internalNote: `Normal payment confirmed across all 4 stages. Linked to SMS ID ${matchedSms.id}.`,
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

  // Check 11: Missing evidence (System cannot confidently establish payment occurred yet)
  stages.push({
    stage: 4,
    name: 'Bank SMS Cross-Reconciliation',
    status: 'PENDING',
    summary: 'Missing evidence: Slip valid, but no matching credit record exists in current bank feed.',
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
    confidenceScore: 78,
    rejectionCategory: 'MISSING_EVIDENCE',
    customerMessage: 'Payment slip parsed and verified. We are awaiting confirmation from the bank settlement feed; your order will update shortly.',
    internalNote: 'Missing settlement evidence: Stages 1-3 passed, but matching Bank SMS is not yet present in bank feed. Listening for gateway credit.',
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
    'Missing evidence: Slip verified. Awaiting bank SMS feed credit or manual staff override.',
    submissionId
  );

  return submission;
}

/**
 * Triggered when a new Bank SMS is ingested or simulated.
 * Scans all pending submissions with 'NEEDS_VERIFICATION' and attempts auto-reconciliation,
 * respecting multi-customer disambiguation rules.
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

    // Check multi-customer ambiguity on incoming feed
    if (isAmountMatch && !isRefMatch && db.merchantConfig.enforceMultiCustomerDisambiguation) {
      const similarOrders = db.findSimilarPendingOrders(order.amount, order.id);
      if (similarOrders.length > 0) {
        // Without explicit reference or sender corroboration, do not auto-claim to prevent wrongful credit!
        continue;
      }
    }

    if (isAmountMatch && (isAccMatch || isRefMatch)) {
      const claimed = db.claimBankSms(newSms.id, order.id, sub.id);
      if (!claimed) continue;

      sub.status = 'APPROVED';
      sub.verification.decision = 'APPROVED';
      sub.verification.confidenceScore = 99;
      sub.verification.rejectionCategory = 'NORMAL_PAYMENT';
      sub.verification.matchedSmsId = newSms.id;
      sub.verification.matchedSms = newSms;
      sub.verification.customerMessage = 'Payment confirmed! Bank SMS credit notification received and matched.';
      sub.verification.internalNote = `Auto-reconciled on arrival of Bank SMS ${newSms.id}. Order marked APPROVED.`;

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
      break;
    }
  }

  return reconciled;
}
