import { TestScenario } from '../src/types/payment.js';

function createSvgSlipDataUrl(opts: {
  bankName: string;
  bankColor: string;
  amount: number;
  currency: string;
  refNumber: string;
  dateStr: string;
  senderName: string;
  senderAcc: string;
  recipientName: string;
  recipientAcc: string;
  isTampered?: boolean;
  isBlurry?: boolean;
  tamperScore?: number;
  tamperReasons?: string[];
  isLegible?: boolean;
  notes?: string;
}): string {
  const blurFilter = opts.isBlurry
    ? `<filter id="blur"><feGaussianBlur stdDeviation="7" /></filter>`
    : '';
  const filterAttr = opts.isBlurry ? `filter="url(#blur)"` : '';

  // Tamper artifact: if tampered, draw an obvious background box with different shade behind amount
  const tamperArtifacts = opts.isTampered
    ? `
    <rect x="70" y="240" width="220" height="48" fill="#e2e8f0" stroke="#94a3b8" stroke-dasharray="2,2" rx="4" />
    <text x="75" y="235" font-family="monospace" font-size="9" fill="#dc2626">ANOMALY: FONT_MISMATCH</text>
    `
    : '';

  const amountColor = opts.isTampered ? '#b91c1c' : '#0f172a';
  const amountFont = opts.isTampered ? 'Courier New, monospace' : 'system-ui, sans-serif';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 520" width="360" height="520">
  <defs>
    ${blurFilter}
    <linearGradient id="bankGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${opts.bankColor}" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>

  <!-- Background Card -->
  <rect x="10" y="10" width="340" height="500" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
  
  <g ${filterAttr}>
    <!-- Bank Header -->
    <rect x="10" y="10" width="340" height="85" rx="16" fill="url(#bankGrad)" />
    <circle cx="45" cy="52" r="18" fill="#ffffff" opacity="0.2" />
    <text x="45" y="58" font-family="sans-serif" font-weight="bold" font-size="16" fill="#ffffff" text-anchor="middle">⚡</text>
    <text x="75" y="47" font-family="sans-serif" font-weight="bold" font-size="16" fill="#ffffff">${opts.bankName}</text>
    <text x="75" y="66" font-family="sans-serif" font-size="11" fill="#93c5fd">Electronic Funds Transfer Receipt</text>

    <!-- Amount Display -->
    ${tamperArtifacts}
    <text x="180" y="135" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle">TOTAL AMOUNT TRANSFERRED</text>
    <text x="180" y="175" font-family="${amountFont}" font-weight="bold" font-size="28" fill="${amountColor}" text-anchor="middle">
      ${opts.amount.toFixed(2)} <tspan font-size="16" fill="#64748b">${opts.currency}</tspan>
    </text>

    <!-- Divider -->
    <line x1="30" y1="200" x2="330" y2="200" stroke="#f1f5f9" stroke-width="2" />

    <!-- Sender Section -->
    <text x="35" y="225" font-family="sans-serif" font-size="11" fill="#94a3b8">FROM (SENDER)</text>
    <text x="35" y="245" font-family="sans-serif" font-weight="600" font-size="13" fill="#1e293b">${opts.senderName}</text>
    <text x="35" y="262" font-family="monospace" font-size="11" fill="#64748b">${opts.senderAcc}</text>

    <!-- Arrow Indicator -->
    <circle cx="180" cy="275" r="12" fill="#f8fafc" stroke="#cbd5e1" />
    <text x="180" y="279" font-family="sans-serif" font-size="10" fill="#64748b" text-anchor="middle">▼</text>

    <!-- Recipient Section -->
    <text x="35" y="305" font-family="sans-serif" font-size="11" fill="#94a3b8">TO (RECIPIENT)</text>
    <text x="35" y="325" font-family="sans-serif" font-weight="600" font-size="13" fill="#1e293b">${opts.recipientName}</text>
    <text x="35" y="342" font-family="monospace" font-weight="600" font-size="12" fill="#0369a1">${opts.recipientAcc}</text>

    <!-- Metadata Grid -->
    <rect x="25" y="365" width="310" height="90" rx="8" fill="#f8fafc" stroke="#e2e8f0" />
    
    <text x="40" y="390" font-family="sans-serif" font-size="10" fill="#64748b">TRANSACTION REF</text>
    <text x="40" y="408" font-family="monospace" font-weight="bold" font-size="12" fill="#0f172a">${opts.refNumber}</text>

    <text x="40" y="430" font-family="sans-serif" font-size="10" fill="#64748b">DATE &amp; TIME</text>
    <text x="40" y="445" font-family="monospace" font-size="11" fill="#334155">${opts.dateStr}</text>

    <!-- Watermark / Microprint -->
    <text x="180" y="485" font-family="sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle">Official Bank Electronic Transaction · Verified e-Slip</text>
  </g>
</svg>`.trim();

  // Synthetic metadata payload comment embedded for deterministic test engine verification
  const metaPayload = {
    bankName: opts.bankName,
    amount: opts.amount,
    currency: opts.currency,
    transferDateTime: opts.dateStr,
    senderName: opts.senderName,
    senderAccount: opts.senderAcc,
    recipientName: opts.recipientName,
    recipientAccount: opts.recipientAcc,
    referenceNumber: opts.refNumber,
    isLegible: opts.isLegible ?? !opts.isBlurry,
    tamperScore: opts.tamperScore ?? (opts.isTampered ? 0.89 : 0.03),
    tamperReasons:
      opts.tamperReasons ??
      (opts.isTampered
        ? ['Inconsistent font kerning on amount value', 'Bounding box compression artifacts detected around digits']
        : []),
    confidence: opts.isBlurry ? 0.25 : 0.98,
    rawNotes: opts.notes || 'Synthetic test slip',
  };

  const encodedMeta = encodeURIComponent(JSON.stringify(metaPayload));
  const base64Svg = Buffer.from(svg).toString('base64');

  // Embed marker in data URL
  return `data:image/svg+xml;base64,${base64Svg}#PAYVERIFY_META_START${encodedMeta}PAYVERIFY_META_END`;
}

export function getTestScenarios(): TestScenario[] {
  return [
    {
      id: 'SCENARIO-01-PERFECT-MATCH',
      title: '01. Legitimate Exact Match',
      category: 'Golden Path',
      description: 'Customer transfers exact 150.00 THB to merchant account. Corresponding SCB SMS already present in bank feed. All 4 stages pass with 99% confidence.',
      expectedDecision: 'APPROVED',
      orderId: 'ORD-8491',
      slipDescription: 'Valid SCB slip: 150.00 THB to 042-8-91283-4, Ref SCB-2026-89102',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 150.0,
        currency: 'THB',
        refNumber: 'SCB-2026-89102',
        dateStr: '2026-09-28 14:15:00',
        senderName: 'Somchai Prasert',
        senderAcc: 'x-9124',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
      }),
      simulatedSmsPreloaded: true,
    },
    {
      id: 'SCENARIO-02-DUPLICATE-SLIP',
      title: '02. Duplicate Slip (SHA-256 Pre-Check)',
      category: 'Fraud Defense',
      description: 'Attacker re-uploads an identical slip previously submitted and approved on another order. Engine detects duplicate SHA-256 hash in Stage 1 with 0 AI tokens spent.',
      expectedDecision: 'REJECTED',
      expectedRejectionCategory: 'DUPLICATE_IMAGE',
      expectedStageFailure: 1,
      orderId: 'ORD-8492',
      slipDescription: 'Re-uploading the approved receipt hash from previous order ORD-8490',
      slipImageDataUrl: 'data:text/plain;base64,' + Buffer.from('HASH_PREV_APPROVED_SLIP_SAMPLE').toString('base64'),
    },
    {
      id: 'SCENARIO-03-TAMPERED-AMOUNT',
      title: '03. Photoshopped / Altered Amount',
      category: 'Fraud Defense',
      description: 'Customer edited $15.00 into $150.00 using image editing software. Gemini multimodal model flags abnormal font kerning and pixel halos (tamper score 0.89). Rejected in Stage 3.',
      expectedDecision: 'REJECTED',
      expectedRejectionCategory: 'TAMPERED_SLIP',
      expectedStageFailure: 3,
      orderId: 'ORD-8491',
      slipDescription: 'Slip with manipulated amount digits and mismatched font metrics',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 150.0,
        currency: 'THB',
        refNumber: 'SCB-2026-89102',
        dateStr: '2026-09-28 14:15:00',
        senderName: 'Somchai Prasert',
        senderAcc: 'x-9124',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
        isTampered: true,
        tamperScore: 0.89,
        tamperReasons: [
          'Inconsistent font kerning and weight on amount digits',
          'Bounding box compression artifacts indicate digital clone brush tampering',
        ],
      }),
    },
    {
      id: 'SCENARIO-04-UNDERPAYMENT',
      title: '04. Amount Mismatch (Underpayment)',
      category: 'Rule Engine',
      description: 'Order requires 890.00 THB, but customer only transferred 500.00 THB. Stage 3 detects amount discrepancy and rejects with clear customer calculation.',
      expectedDecision: 'REJECTED',
      expectedRejectionCategory: 'AMOUNT_MISMATCH',
      expectedStageFailure: 3,
      orderId: 'ORD-8492',
      slipDescription: 'Slip for 500.00 THB submitted for an 890.00 THB order',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Kasikornbank',
        bankColor: '#065f46',
        amount: 500.0,
        currency: 'THB',
        refNumber: 'KBANK-2026-44102',
        dateStr: '2026-09-28 14:10:00',
        senderName: 'Ananya Tech Co.',
        senderAcc: 'x-4190',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
      }),
    },
    {
      id: 'SCENARIO-05-WRONG-ACCOUNT',
      title: '05. Wrong Receiving Account',
      category: 'Rule Engine',
      description: 'Customer transferred money to a personal friend account (ending 9991) instead of the merchant account (ending 2834). Rejected at Stage 3 with account highlight.',
      expectedDecision: 'REJECTED',
      expectedRejectionCategory: 'ACCOUNT_MISMATCH',
      expectedStageFailure: 3,
      orderId: 'ORD-8493',
      slipDescription: 'Slip sent to personal account 819-2-99991-0',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 250.0,
        currency: 'THB',
        refNumber: 'SCB-2026-99381',
        dateStr: '2026-09-28 14:05:00',
        senderName: 'Siriporn Miller',
        senderAcc: 'x-7712',
        recipientName: 'Mr. Unaffiliated Third-Party',
        recipientAcc: '819-2-99991-0',
      }),
    },
    {
      id: 'SCENARIO-06-REUSED-REFERENCE',
      title: '06. Reused Reference Number Collision',
      category: 'Fraud Defense',
      description: 'Customer attempts to submit a newly generated slip graphic bearing a transaction reference code (TXN-REUSED-9901) that was already claimed by an older order.',
      expectedDecision: 'REJECTED',
      expectedRejectionCategory: 'REUSED_REFERENCE',
      expectedStageFailure: 3,
      orderId: 'ORD-8493',
      slipDescription: 'New graphic with recycled reference # TXN-REUSED-9901',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 250.0,
        currency: 'THB',
        refNumber: 'TXN-REUSED-9901',
        dateStr: '2026-09-28 14:00:00',
        senderName: 'Siriporn Miller',
        senderAcc: 'x-7712',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
      }),
    },
    {
      id: 'SCENARIO-07-DELAYED-SMS',
      title: '07. Delayed Bank SMS (Pending Auto-Reconciliation)',
      category: 'Cross-Reconciliation',
      description: 'Slip is 100% genuine and matches 250.00 THB order. However, bank SMS gateway has not arrived yet. Marked NEEDS_VERIFICATION. Ingesting SMS will auto-approve it!',
      expectedDecision: 'NEEDS_VERIFICATION',
      orderId: 'ORD-8493',
      slipDescription: 'Legitimate slip for 250.00 THB, bank SMS pending delivery',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 250.0,
        currency: 'THB',
        refNumber: 'SCB-2026-PENDING-250',
        dateStr: '2026-09-28 14:25:00',
        senderName: 'Siriporn Miller',
        senderAcc: 'x-7712',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
      }),
      simulatedSmsText: 'SCB Easy: Money in +THB 250.00 to a/c x2834 from SIRIPORN M. Ref: SCB-2026-PENDING-250. 28/09/2026 14:26. Avail Bal: 185,340.00',
      simulatedSmsSender: 'SCB-ALERT',
      simulatedSmsPreloaded: false,
    },
    {
      id: 'SCENARIO-08-REUSED-SMS-CLAIM',
      title: '08. Conflicting Bank SMS (Double-Claim Attack)',
      category: 'Fraud Defense',
      description: 'Attacker creates a slip with amount 320.00 THB matching an SMS that has already been reconciled with order ORD-8490. Stage 4 catches the claim conflict.',
      expectedDecision: 'REJECTED',
      expectedRejectionCategory: 'CLAIM_CONFLICT',
      expectedStageFailure: 4,
      orderId: 'ORD-8494',
      slipDescription: 'Slip targeting already-claimed SMS-102 (320.00 THB)',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Kasikornbank',
        bankColor: '#065f46',
        amount: 320.0,
        currency: 'THB',
        refNumber: 'KBANK-77182',
        dateStr: '2026-09-28 11:04:00',
        senderName: 'Kittisak Wong',
        senderAcc: 'x-4819',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
      }),
    },
    {
      id: 'SCENARIO-09-STALE-DATE',
      title: '09. Expired / Stale Transfer Slip',
      category: 'Rule Engine',
      description: 'Customer submits a slip from 14 days ago. Stage 3 calculates time delta exceeds the 24-hour merchant stale threshold and rejects.',
      expectedDecision: 'REJECTED',
      expectedRejectionCategory: 'STALE_DATE',
      expectedStageFailure: 3,
      orderId: 'ORD-8494',
      slipDescription: 'Old slip dated 14 days before order creation',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Kasikornbank',
        bankColor: '#065f46',
        amount: 1200.0,
        currency: 'THB',
        refNumber: 'KBANK-OLD-11029',
        dateStr: '2026-09-14 09:30:00',
        senderName: 'Kittisak Wong',
        senderAcc: 'x-4819',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
      }),
    },
    {
      id: 'SCENARIO-10-BLURRY-ILLEGIBLE',
      title: '10. Blurry / Unreadable Camera Shot',
      category: 'OCR Quality',
      description: 'Customer submitted a heavily blurred, out-of-focus slip photo. Gemini OCR detects low legibility (confidence 0.25) and requests a clearer photo.',
      expectedDecision: 'REJECTED',
      expectedRejectionCategory: 'ILLEGIBLE_SLIP',
      expectedStageFailure: 2,
      orderId: 'ORD-8494',
      slipDescription: 'Optical motion-blurred photograph',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Kasikornbank',
        bankColor: '#065f46',
        amount: 1200.0,
        currency: 'THB',
        refNumber: 'KBANK-99120',
        dateStr: '2026-09-28 14:12:00',
        senderName: 'Kittisak Wong',
        senderAcc: 'x-4819',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
        isBlurry: true,
        isLegible: false,
      }),
    },
  ];
}
