export type VerificationDecision = 'APPROVED' | 'REJECTED' | 'NEEDS_VERIFICATION';

export type RejectionCategory =
  | 'DUPLICATE_IMAGE'
  | 'ILLEGIBLE_SLIP'
  | 'TAMPERED_SLIP'
  | 'AMOUNT_MISMATCH'
  | 'ACCOUNT_MISMATCH'
  | 'REUSED_REFERENCE'
  | 'STALE_DATE'
  | 'CLAIM_CONFLICT';

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  currency: string;
  status: 'PENDING_PAYMENT' | 'NEEDS_VERIFICATION' | 'APPROVED' | 'REJECTED';
  targetAccount: string; // e.g. "042-8-91283-4"
  targetBank: string; // e.g. "Kasikornbank"
  itemDescription: string;
  createdAt: string;
  settledAt?: string;
  submissionId?: string;
}

export interface BankSMS {
  id: string;
  sender: string;
  rawText: string;
  receivedAt: string;
  parsedAmount: number;
  parsedCurrency: string;
  parsedAccountSuffix: string;
  parsedSenderInfo?: string;
  parsedRef?: string;
  claimedByOrderId: string | null;
  claimedBySubmissionId: string | null;
  claimedAt: string | null;
}

export interface SlipExtraction {
  bankName: string;
  amount: number;
  currency: string;
  transferDateTime: string;
  senderName: string;
  senderAccount: string;
  recipientName: string;
  recipientAccount: string;
  referenceNumber: string;
  isLegible: boolean;
  tamperScore: number; // 0.0 (pristine) to 1.0 (heavily edited)
  tamperReasons: string[];
  confidence: number;
  rawNotes?: string;
  modelUsed: string;
}

export interface StageOutcome {
  stage: 1 | 2 | 3 | 4;
  name: string;
  status: 'PASSED' | 'FAILED' | 'PENDING' | 'SKIPPED';
  summary: string;
  executionTimeMs: number;
  details: Record<string, any>;
}

export interface VerificationResult {
  submissionId: string;
  orderId: string;
  decision: VerificationDecision;
  confidenceScore: number; // 0 - 100
  rejectionCategory?: RejectionCategory;
  rejectionReason?: string;
  customerMessage: string;
  internalNote: string;
  stages: StageOutcome[];
  extraction?: SlipExtraction;
  matchedSmsId?: string;
  matchedSms?: BankSMS;
  createdAt: string;
  imageHash: string;
  perceptualHash?: string;
}

export interface Submission {
  id: string;
  orderId: string;
  imageUrl: string;
  imageHash: string;
  status: VerificationDecision;
  verification: VerificationResult;
  submittedAt: string;
  manualOverride?: {
    overriddenBy: string;
    overriddenAt: string;
    previousStatus: string;
    newStatus: string;
    reason: string;
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  orderId: string;
  submissionId?: string;
  details: string;
}

export interface MerchantConfig {
  merchantName: string;
  authorizedAccounts: Array<{
    bankName: string;
    accountNumber: string;
    accountSuffix: string;
    accountHolder: string;
  }>;
  requireSmsReconciliation: boolean;
  tamperScoreThreshold: number; // default 0.40
  staleMinutesThreshold: number; // default 1440 (24h)
  allowMinorCentsRounding: boolean;
}

export interface TestScenario {
  id: string;
  title: string;
  category: string;
  description: string;
  expectedDecision: VerificationDecision;
  expectedRejectionCategory?: RejectionCategory;
  expectedStageFailure?: number;
  orderId: string;
  slipDescription: string;
  slipImageDataUrl: string;
  simulatedSmsText?: string;
  simulatedSmsSender?: string;
  simulatedSmsPreloaded?: boolean;
}
