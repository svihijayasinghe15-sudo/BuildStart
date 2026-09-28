import { Order, BankSMS, Submission, AuditLog, MerchantConfig } from '../src/types/payment.js';
import { parseBankSMS } from './smsParser.js';

class InMemoryDatabase {
  orders: Order[] = [];
  bankSms: BankSMS[] = [];
  submissions: Submission[] = [];
  auditLogs: AuditLog[] = [];
  approvedHashes: Map<string, { orderId: string; submissionId: string; referenceNumber: string }> = new Map();
  claimedReferences: Map<string, { orderId: string; submissionId: string; approved: boolean }> = new Map();

  merchantConfig: MerchantConfig = {
    merchantName: 'PayVerify Cloud Services Ltd',
    authorizedAccounts: [
      {
        bankName: 'Siam Commercial Bank',
        accountNumber: '042-8-91283-4',
        accountSuffix: '2834',
        accountHolder: 'PAYVERIFY CO LTD',
      },
      {
        bankName: 'Kasikornbank',
        accountNumber: '042-8-91283-4',
        accountSuffix: '2834',
        accountHolder: 'PAYVERIFY CO LTD',
      },
    ],
    requireSmsReconciliation: true,
    tamperScoreThreshold: 0.4,
    staleMinutesThreshold: 1440,
    allowMinorCentsRounding: false,
  };

  constructor() {
    this.seedDefaults();
  }

  seedDefaults() {
    this.orders = [
      {
        id: 'ORD-8491',
        customerName: 'Somchai Prasert',
        customerPhone: '+66 81 234 5678',
        amount: 150.0,
        currency: 'THB',
        status: 'PENDING_PAYMENT',
        targetAccount: '042-8-91283-4',
        targetBank: 'Siam Commercial Bank',
        itemDescription: 'Cloud Infrastructure Plan (Monthly)',
        createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      },
      {
        id: 'ORD-8492',
        customerName: 'Ananya Tech Co.',
        customerPhone: '+66 89 876 5432',
        amount: 890.0,
        currency: 'THB',
        status: 'PENDING_PAYMENT',
        targetAccount: '042-8-91283-4',
        targetBank: 'Siam Commercial Bank',
        itemDescription: 'Enterprise Security Gateway License',
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
      {
        id: 'ORD-8493',
        customerName: 'Siriporn Miller',
        customerPhone: '+66 92 345 6789',
        amount: 250.0,
        currency: 'THB',
        status: 'PENDING_PAYMENT',
        targetAccount: '042-8-91283-4',
        targetBank: 'Siam Commercial Bank',
        itemDescription: 'Developer Pro Workspace (Annual)',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'ORD-8494',
        customerName: 'Kittisak Wong',
        customerPhone: '+66 61 223 3445',
        amount: 1200.0,
        currency: 'THB',
        status: 'PENDING_PAYMENT',
        targetAccount: '042-8-91283-4',
        targetBank: 'Kasikornbank',
        itemDescription: 'Custom Domain Provisioning & Managed SSL',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      {
        id: 'ORD-8490',
        customerName: 'David Chen',
        customerPhone: '+66 85 999 1122',
        amount: 320.0,
        currency: 'THB',
        status: 'APPROVED',
        targetAccount: '042-8-91283-4',
        targetBank: 'Kasikornbank',
        itemDescription: 'API Token Pack (1,000,000 credits)',
        createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        settledAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        submissionId: 'SUB-PREV-APPROVED-001',
      },
    ];

    // Seed Bank SMS Feed
    this.bankSms = [
      {
        id: 'SMS-101',
        sender: 'SCB-ALERT',
        rawText: 'SCB Easy: Money in +THB 150.00 to a/c x2834 from MR SOMCHAI P. Ref: SCB-2026-89102. 28/09/2026 14:15. Avail Bal: 184,200.00',
        receivedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        parsedAmount: 150.0,
        parsedCurrency: 'THB',
        parsedAccountSuffix: '2834',
        parsedSenderInfo: 'MR SOMCHAI P',
        parsedRef: 'SCB-2026-89102',
        claimedByOrderId: null,
        claimedBySubmissionId: null,
        claimedAt: null,
      },
      {
        id: 'SMS-102',
        sender: 'KBANK-SMS',
        rawText: 'You have received 320.00 THB from x-4819 to a/c x-2834 on 28/09/2026 11:04. Ref: KBANK-77182. Avail Bal: 184,050.00',
        receivedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
        parsedAmount: 320.0,
        parsedCurrency: 'THB',
        parsedAccountSuffix: '2834',
        parsedSenderInfo: 'x-4819',
        parsedRef: 'KBANK-77182',
        claimedByOrderId: 'ORD-8490',
        claimedBySubmissionId: 'SUB-PREV-APPROVED-001',
        claimedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      },
      {
        id: 'SMS-103',
        sender: 'SCB-ALERT',
        rawText: 'SCB Easy: Money in +THB 890.00 to a/c x2834 from ANANYA TECH CO. Ref: SCB-2026-99214. 28/09/2026 14:18. Avail Bal: 185,090.00',
        receivedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        parsedAmount: 890.0,
        parsedCurrency: 'THB',
        parsedAccountSuffix: '2834',
        parsedSenderInfo: 'ANANYA TECH CO',
        parsedRef: 'SCB-2026-99214',
        claimedByOrderId: null,
        claimedBySubmissionId: null,
        claimedAt: null,
      },
    ];

    // Seed duplicate reference & hash records
    this.approvedHashes.clear();
    this.approvedHashes.set('HASH_PREV_APPROVED_SLIP_SAMPLE', {
      orderId: 'ORD-8490',
      submissionId: 'SUB-PREV-APPROVED-001',
      referenceNumber: 'KBANK-77182',
    });

    this.claimedReferences.clear();
    this.claimedReferences.set('KBANK-77182', {
      orderId: 'ORD-8490',
      submissionId: 'SUB-PREV-APPROVED-001',
      approved: true,
    });
    this.claimedReferences.set('TXN-REUSED-9901', {
      orderId: 'ORD-8488',
      submissionId: 'SUB-ARCHIVE-9901',
      approved: true,
    });

    this.auditLogs = [
      {
        id: 'AUD-001',
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        actor: 'Auto-Verification Engine',
        action: 'AUTO_APPROVE',
        orderId: 'ORD-8490',
        submissionId: 'SUB-PREV-APPROVED-001',
        details: '4-Stage Pipeline Passed with matched SMS-102. Amount: 320.00 THB. Ref: KBANK-77182.',
      },
      {
        id: 'AUD-000',
        timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
        actor: 'System Initialization',
        action: 'ENGINE_START',
        orderId: 'SYSTEM',
        details: 'PayVerify Verification & Fraud Engine v2.4 initialized with active SMS feed listener.',
      },
    ];

    this.submissions = [];
  }

  // Orders
  getOrders(): Order[] {
    return this.orders;
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.find((o) => o.id === id);
  }

  updateOrder(id: string, updates: Partial<Order>): Order | null {
    const idx = this.orders.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    this.orders[idx] = { ...this.orders[idx], ...updates };
    return this.orders[idx];
  }

  // Bank SMS
  getBankSmsFeed(): BankSMS[] {
    return this.bankSms;
  }

  getBankSmsById(id: string): BankSMS | undefined {
    return this.bankSms.find((s) => s.id === id);
  }

  addBankSms(rawText: string, sender: string = 'SCB-ALERT'): BankSMS {
    const parsed = parseBankSMS(rawText);
    const newSms: BankSMS = {
      id: `SMS-${Date.now().toString().slice(-5)}`,
      sender,
      rawText,
      receivedAt: new Date().toISOString(),
      parsedAmount: parsed.amount,
      parsedCurrency: parsed.currency,
      parsedAccountSuffix: parsed.accountSuffix || '2834',
      parsedSenderInfo: parsed.senderInfo,
      parsedRef: parsed.referenceNumber,
      claimedByOrderId: null,
      claimedBySubmissionId: null,
      claimedAt: null,
    };
    this.bankSms.unshift(newSms);

    this.addAuditLog(
      'SMS Webhook Gateway',
      'SMS_RECEIVED',
      'BANK_FEED',
      `Ingested SMS: ${parsed.amount} ${parsed.currency} -> a/c ...${parsed.accountSuffix || '2834'}. Ref: ${parsed.referenceNumber || 'N/A'}`
    );

    return newSms;
  }

  claimBankSms(smsId: string, orderId: string, submissionId: string): boolean {
    const sms = this.getBankSmsById(smsId);
    if (!sms) return false;
    if (sms.claimedByOrderId && sms.claimedByOrderId !== orderId) {
      return false; // already claimed by different order
    }
    sms.claimedByOrderId = orderId;
    sms.claimedBySubmissionId = submissionId;
    sms.claimedAt = new Date().toISOString();
    return true;
  }

  unclaimBankSms(smsId: string): void {
    const sms = this.getBankSmsById(smsId);
    if (sms) {
      sms.claimedByOrderId = null;
      sms.claimedBySubmissionId = null;
      sms.claimedAt = null;
    }
  }

  findMatchingSms(
    amount: number,
    currency: string,
    targetAccountSuffix: string,
    referenceNumber?: string,
    orderId?: string
  ): { matched: BankSMS | null; conflictReason?: string } {
    // 1. If referenceNumber provided, search for exact reference match first
    if (referenceNumber) {
      const refMatch = this.bankSms.find(
        (s) => s.parsedRef && s.parsedRef.toLowerCase() === referenceNumber.toLowerCase()
      );
      if (refMatch) {
        if (refMatch.claimedByOrderId && refMatch.claimedByOrderId !== orderId) {
          return {
            matched: null,
            conflictReason: `Bank SMS deposit with Ref ${referenceNumber} was already claimed by ${refMatch.claimedByOrderId}`,
          };
        }
        return { matched: refMatch };
      }
    }

    // 2. Match by exact amount, currency, and account suffix
    const amountMatch = this.bankSms.find((s) => {
      const isAmountClose = Math.abs(s.parsedAmount - amount) < 0.01;
      const isAccountMatch =
        !targetAccountSuffix ||
        !s.parsedAccountSuffix ||
        s.parsedAccountSuffix === targetAccountSuffix ||
        targetAccountSuffix.endsWith(s.parsedAccountSuffix);
      const isAvailable = !s.claimedByOrderId || s.claimedByOrderId === orderId;

      return isAmountClose && isAccountMatch && isAvailable;
    });

    if (amountMatch) {
      return { matched: amountMatch };
    }

    // Check if an SMS with this amount was already consumed by another order
    const claimedMatch = this.bankSms.find((s) => {
      const isAmountClose = Math.abs(s.parsedAmount - amount) < 0.01;
      return isAmountClose && s.claimedByOrderId && s.claimedByOrderId !== orderId;
    });

    if (claimedMatch) {
      return {
        matched: null,
        conflictReason: `Found matching credit of ${amount} in bank feed, but it was already reconciled with order ${claimedMatch.claimedByOrderId}`,
      };
    }

    return { matched: null };
  }

  // Submissions
  getSubmissions(): Submission[] {
    return this.submissions;
  }

  getSubmissionById(id: string): Submission | undefined {
    return this.submissions.find((s) => s.id === id);
  }

  saveSubmission(submission: Submission): void {
    const existingIdx = this.submissions.findIndex((s) => s.id === submission.id);
    if (existingIdx !== -1) {
      this.submissions[existingIdx] = submission;
    } else {
      this.submissions.unshift(submission);
    }

    if (submission.status === 'APPROVED') {
      this.approvedHashes.set(submission.imageHash, {
        orderId: submission.orderId,
        submissionId: submission.id,
        referenceNumber: submission.verification.extraction?.referenceNumber || '',
      });
      if (submission.verification.extraction?.referenceNumber) {
        this.claimedReferences.set(submission.verification.extraction.referenceNumber, {
          orderId: submission.orderId,
          submissionId: submission.id,
          approved: true,
        });
      }
    }
  }

  checkDuplicateHash(hash: string): { isDuplicate: boolean; previous?: { orderId: string; submissionId: string } } {
    if (this.approvedHashes.has(hash)) {
      return { isDuplicate: true, previous: this.approvedHashes.get(hash) };
    }
    return { isDuplicate: false };
  }

  checkDuplicateReference(
    refNumber: string,
    currentOrderId: string
  ): { isDuplicate: boolean; previous?: { orderId: string; submissionId: string } } {
    if (!refNumber) return { isDuplicate: false };
    const prev = this.claimedReferences.get(refNumber);
    if (prev && prev.orderId !== currentOrderId) {
      return { isDuplicate: true, previous: prev };
    }
    return { isDuplicate: false };
  }

  // Audit Logs
  addAuditLog(actor: string, action: string, orderId: string, details: string, submissionId?: string): AuditLog {
    const log: AuditLog = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      orderId,
      submissionId,
      details,
    };
    this.auditLogs.unshift(log);
    return log;
  }

  getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }
}

export const db = new InMemoryDatabase();
