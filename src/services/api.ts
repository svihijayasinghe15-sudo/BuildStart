import {
  Order,
  Submission,
  BankSMS,
  AuditLog,
  MerchantConfig,
  TestScenario,
} from '../types/payment';

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders');
  const json = await res.json();
  return json.data || [];
}

export async function fetchSubmissions(status?: string): Promise<Submission[]> {
  const url = status && status !== 'ALL' ? `/api/submissions?status=${status}` : '/api/submissions';
  const res = await fetch(url);
  const json = await res.json();
  return json.data || [];
}

export async function fetchSmsFeed(): Promise<BankSMS[]> {
  const res = await fetch('/api/sms-feed');
  const json = await res.json();
  return json.data || [];
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch('/api/audit-logs');
  const json = await res.json();
  return json.data || [];
}

export async function fetchScenarios(): Promise<TestScenario[]> {
  const res = await fetch('/api/scenarios');
  const json = await res.json();
  return json.data || [];
}

export async function fetchMerchantConfig(): Promise<MerchantConfig> {
  const res = await fetch('/api/merchant-config');
  const json = await res.json();
  return json.data;
}

export async function updateMerchantConfig(updates: Partial<MerchantConfig>): Promise<MerchantConfig> {
  const res = await fetch('/api/merchant-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const json = await res.json();
  return json.data;
}

export async function verifySlip(orderId: string, imageDataUri: string): Promise<Submission> {
  const res = await fetch('/api/verify-slip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, imageDataUri }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Verification failed');
  }
  return json.data;
}

export async function simulateIncomingSms(
  rawText: string,
  sender: string = 'SCB-ALERT'
): Promise<{ sms: BankSMS; autoReconciled: Array<{ orderId: string; submissionId: string }> }> {
  const res = await fetch('/api/simulate-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, sender }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Failed to simulate SMS');
  }
  return json.data;
}

export async function submitManualOverride(
  submissionId: string,
  staffName: string,
  newStatus: string,
  reason: string
): Promise<Submission> {
  const res = await fetch(`/api/submissions/${submissionId}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffName, newStatus, reason }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Override failed');
  }
  return json.data;
}

export async function resetDatabase(): Promise<void> {
  await fetch('/api/reset-data', { method: 'POST' });
}
