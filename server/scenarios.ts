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
  isCropped?: boolean;
  isDark?: boolean;
  tamperScore?: number;
  tamperReasons?: string[];
  isLegible?: boolean;
  notes?: string;
}): string {
  const blurFilter = opts.isBlurry
    ? `<filter id="blur"><feGaussianBlur stdDeviation="7" /></filter>`
    : '';
  const filterAttr = opts.isBlurry ? `filter="url(#blur)"` : '';
  const darkOverlay = opts.isDark
    ? `<rect x="0" y="0" width="360" height="520" fill="#000000" opacity="0.65" />`
    : '';
  const viewBox = opts.isCropped ? 'viewBox="40 50 280 400"' : 'viewBox="0 0 360 520"';

  // Tamper artifact: if tampered, draw an obvious background box with different shade behind amount
  const tamperArtifacts = opts.isTampered
    ? `
    <rect x="70" y="240" width="220" height="48" fill="#e2e8f0" stroke="#94a3b8" stroke-dasharray="2,2" rx="4" />
    <text x="75" y="235" font-family="monospace" font-size="9" fill="#dc2626">FORENSIC ANOMALY: FONT_KERNING_ALTERED</text>
    `
    : '';

  const amountColor = opts.isTampered ? '#b91c1c' : '#0f172a';
  const amountFont = opts.isTampered ? 'Courier New, monospace' : 'system-ui, sans-serif';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" ${viewBox} width="360" height="520">
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
  ${darkOverlay}
</svg>`.trim();

  // Synthetic metadata payload comment embedded for deterministic test engine verification
  const isUnclear = Boolean(opts.isBlurry || opts.isCropped || opts.isDark || opts.isLegible === false);
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
    isLegible: !isUnclear,
    isCroppedOrDark: Boolean(opts.isCropped || opts.isDark),
    tamperScore: opts.tamperScore ?? (opts.isTampered ? 0.89 : 0.03),
    tamperReasons:
      opts.tamperReasons ??
      (opts.isTampered
        ? ['Inconsistent font kerning and weight on amount digits', 'Bounding box clone compression artifacts detected']
        : []),
    confidence: isUnclear ? 0.28 : 0.98,
    rawNotes: opts.notes || 'Synthetic test vector',
  };

  const encodedMeta = encodeURIComponent(JSON.stringify(metaPayload));
  const base64Svg = Buffer.from(svg).toString('base64');

  return `data:image/svg+xml;base64,${base64Svg}#PAYVERIFY_META_START${encodedMeta}PAYVERIFY_META_END`;
}

export function getTestScenarios(): TestScenario[] {
  return [
    {
      id: 'OP-01-NORMAL-PAYMENT',
      title: '01. Normal Payment',
      situation: 'Normal payment',
      category: 'Golden Path',
      description: 'A genuine payment with matching information: Amount (150.00 THB), authorized business account, unedited slip, and matching bank SMS settlement.',
      expectedDecision: 'APPROVED',
      expectedCategory: 'NORMAL_PAYMENT',
      orderId: 'ORD-8491',
      slipDescription: 'Authentic SCB transfer slip matching order ORD-8491 exactly',
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
      id: 'OP-02-WRONG-AMOUNT',
      title: '02. Wrong Amount (Underpayment / Overpayment)',
      situation: 'Wrong amount',
      category: 'Rule Engine',
      description: 'The customer paid less or more than the required amount. Order total is 890.00 THB, but customer slip shows only 500.00 THB (Shortfall: 390.00 THB).',
      expectedDecision: 'REJECTED',
      expectedCategory: 'WRONG_AMOUNT',
      expectedStageFailure: 3,
      orderId: 'ORD-8492',
      slipDescription: 'Slip with 500.00 THB transferred for an 890.00 THB order',
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
      id: 'OP-03-WRONG-ACCOUNT',
      title: '03. Wrong Account',
      situation: 'Wrong account',
      category: 'Rule Engine',
      description: 'The payment was made to an account that does not belong to the business (Customer transferred funds to personal account 819-2-99991-0).',
      expectedDecision: 'REJECTED',
      expectedCategory: 'WRONG_ACCOUNT',
      expectedStageFailure: 3,
      orderId: 'ORD-8493',
      slipDescription: 'Slip sent to non-merchant personal account 819-2-99991-0',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 250.0,
        currency: 'THB',
        refNumber: 'SCB-2026-99381',
        dateStr: '2026-09-28 14:05:00',
        senderName: 'Siriporn Miller',
        senderAcc: 'x-7712',
        recipientName: 'Mr. Non-Merchant Stranger',
        recipientAcc: '819-2-99991-0',
      }),
    },
    {
      id: 'OP-04-DUPLICATE-PAYMENT',
      title: '04. Duplicate Payment (Exact Slip Re-submission)',
      situation: 'Duplicate payment',
      category: 'Fraud Defense',
      description: 'The same payment slip is submitted more than once. Stage 1 SHA-256 pre-check intercepts identical binary hash in under 2ms with 0 AI tokens spent.',
      expectedDecision: 'REJECTED',
      expectedCategory: 'DUPLICATE_PAYMENT',
      expectedStageFailure: 1,
      orderId: 'ORD-8492',
      slipDescription: 'Exact re-upload of approved receipt hash from previous order ORD-8490',
      slipImageDataUrl: 'data:text/plain;base64,' + Buffer.from('HASH_PREV_APPROVED_SLIP_SAMPLE').toString('base64'),
    },
    {
      id: 'OP-05-REUSED-PAYMENT',
      title: '05. Reused Payment (Another Customer\'s Order)',
      situation: 'Reused payment',
      category: 'Fraud Defense',
      description: 'A genuine payment is submitted for another customer\'s order. The reference code TXN-REUSED-9901 was already credited to another user in the registry.',
      expectedDecision: 'REJECTED',
      expectedCategory: 'REUSED_PAYMENT',
      expectedStageFailure: 3,
      orderId: 'ORD-8493',
      slipDescription: 'Submitting genuine transfer reference TXN-REUSED-9901 previously credited to order ORD-8488',
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
      id: 'OP-06-SAME-PAYMENT-DIFF-IMAGE',
      title: '06. Same Payment, Different Image / Crop',
      situation: 'Same payment, different image',
      category: 'Fraud Defense',
      description: 'The same transaction is submitted as different screenshots/photos/crops. SHA-256 binary hash differs, but Stage 3 detects identical reference code #SCB-GENUINE-REF-8821.',
      expectedDecision: 'REJECTED',
      expectedCategory: 'SAME_PAYMENT_DIFFERENT_IMAGE',
      expectedStageFailure: 3,
      orderId: 'ORD-8491',
      slipDescription: 'Cropped / alternate photograph of previously submitted transaction SCB-GENUINE-REF-8821',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 150.0,
        currency: 'THB',
        refNumber: 'SCB-GENUINE-REF-8821',
        dateStr: '2026-09-28 14:15:00',
        senderName: 'Alice Wong',
        senderAcc: 'x-3321',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
        isCropped: true,
      }),
    },
    {
      id: 'OP-07-OLD-PAYMENT',
      title: '07. Old Payment (Stale Past Transaction)',
      situation: 'Old payment',
      category: 'Rule Engine',
      description: 'A genuine payment from a previous transaction (dated 14 days ago) is submitted for a new order. Stage 3 checks freshness window and rejects.',
      expectedDecision: 'REJECTED',
      expectedCategory: 'OLD_PAYMENT',
      expectedStageFailure: 3,
      orderId: 'ORD-8494',
      slipDescription: 'Genuine slip with transfer timestamp 14 days older than order creation',
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
      id: 'OP-08-EDITED-SLIP',
      title: '08. Edited or Suspicious Slip',
      situation: 'Edited or suspicious slip',
      category: 'Fraud Defense',
      description: 'Information such as amount or reference was manipulated with photo-editing tools. Gemini multimodal forensic inspection flags font kerning and pixel halos (Score 89%).',
      expectedDecision: 'REJECTED',
      expectedCategory: 'EDITED_SLIP',
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
      id: 'OP-09-UNCLEAR-IMAGE',
      title: '09. Unclear Image (Blurry / Dark / Low-Resolution)',
      situation: 'Unclear image',
      category: 'Uncertainty Handling',
      description: 'The slip is blurry, cropped, dark, or difficult to read. System marks NEEDS_VERIFICATION with an actionable prompt to send a clearer screenshot.',
      expectedDecision: 'NEEDS_VERIFICATION',
      expectedCategory: 'UNCLEAR_IMAGE',
      expectedStageFailure: 2,
      orderId: 'ORD-8494',
      slipDescription: 'Optical motion-blurred photograph with illegible text',
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
    {
      id: 'OP-10-CONFLICTING-EVIDENCE',
      title: '10. Conflicting Evidence (Slip vs Bank Feed)',
      situation: 'Conflicting evidence',
      category: 'Cross-Reconciliation',
      description: 'Information extracted from slip contradicts bank SMS data: Slip claims 500.00 THB with ref SCB-CONFLICT-500, but bank SMS reports credit was only 50.00 THB!',
      expectedDecision: 'REJECTED',
      expectedCategory: 'CONFLICTING_EVIDENCE',
      expectedStageFailure: 4,
      orderId: 'ORD-8496',
      slipDescription: 'Slip claiming 500.00 THB under ref SCB-CONFLICT-500, but bank SMS recorded 50.00 THB',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 500.0,
        currency: 'THB',
        refNumber: 'SCB-CONFLICT-500',
        dateStr: '2026-09-28 14:20:00',
        senderName: 'Tanawat Sukjai',
        senderAcc: 'x-4321',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
      }),
      simulatedSmsPreloaded: true,
    },
    {
      id: 'OP-11-MISSING-EVIDENCE',
      title: '11. Missing Evidence (Awaiting Bank Settlement Confirmation)',
      situation: 'Missing evidence',
      category: 'Cross-Reconciliation',
      description: 'The system cannot confidently establish that payment occurred because no matching deposit notification has arrived yet in the bank feed. Queued for auto-reconciliation.',
      expectedDecision: 'NEEDS_VERIFICATION',
      expectedCategory: 'MISSING_EVIDENCE',
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
      id: 'OP-12-SIMILAR-PAYMENTS',
      title: '12. Multiple Customers with Similar Payments',
      situation: 'Multiple customers with similar payments',
      category: 'Anti-False-Attribution',
      description: 'Multiple customers (ORD-8491 & ORD-8495) expect identical 150.00 THB around the same time. System avoids assuming matching amount proves ownership without reference/sender match!',
      expectedDecision: 'NEEDS_VERIFICATION',
      expectedCategory: 'AMBIGUOUS_SIMILAR_PAYMENTS',
      expectedStageFailure: 4,
      orderId: 'ORD-8495',
      slipDescription: 'Generic deposit slip for 150.00 THB where SMS feed lacks unique reference number',
      slipImageDataUrl: createSvgSlipDataUrl({
        bankName: 'Siam Commercial Bank',
        bankColor: '#4c1d95',
        amount: 150.0,
        currency: 'THB',
        refNumber: 'SCB-UNLINKED-150',
        dateStr: '2026-09-28 14:16:00',
        senderName: 'Kamonwan Boonmee',
        senderAcc: 'x-7766',
        recipientName: 'PayVerify Cloud Services Ltd',
        recipientAcc: '042-8-91283-4',
      }),
    },
  ];
}
