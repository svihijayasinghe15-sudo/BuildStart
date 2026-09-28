import React, { useState } from 'react';
import { X, Send, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { simulateIncomingSms } from '../services/api';
import { BankSMS } from '../types/payment';

interface SmsSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSmsInjected: (sms: BankSMS, autoReconciled: Array<{ orderId: string; submissionId: string }>) => void;
}

export const SmsSimulatorModal: React.FC<SmsSimulatorModalProps> = ({
  isOpen,
  onClose,
  onSmsInjected,
}) => {
  const [sender, setSender] = useState('SCB-ALERT');
  const [smsText, setSmsText] = useState(
    'SCB Easy: Money in +THB 250.00 to a/c x2834 from SIRIPORN M. Ref: SCB-2026-PENDING-250. 28/09/2026 14:26. Avail Bal: 185,340.00'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    sms?: BankSMS;
    reconciledCount?: number;
    reconciledOrders?: string[];
  } | null>(null);

  if (!isOpen) return null;

  const presets = [
    {
      label: 'SCB +250.00 THB (Matches Pending ORD-8493)',
      sender: 'SCB-ALERT',
      text: 'SCB Easy: Money in +THB 250.00 to a/c x2834 from SIRIPORN M. Ref: SCB-2026-PENDING-250. 28/09/2026 14:26. Avail Bal: 185,340.00',
    },
    {
      label: 'KBANK +1,200.00 THB (Matches ORD-8494)',
      sender: 'KBANK-SMS',
      text: 'You have received 1,200.00 THB from x-4819 to a/c x-2834 on 28/09/2026 14:30. Ref: KBANK-99120. Avail Bal: 186,540.00',
    },
    {
      label: 'SCB +150.00 THB (Standard Deposit)',
      sender: 'SCB-ALERT',
      text: 'SCB Easy: Money in +THB 150.00 to a/c x2834 from S. PRASERT. Ref: SCB-2026-90112. 28/09/2026 14:35. Avail Bal: 186,690.00',
    },
    {
      label: 'Chase Deposit $150.00 (US Format)',
      sender: 'CHASE-ALERT',
      text: 'Chase Alert: Direct deposit of $150.00 has posted to your account ending in 2834. Ref: CHS-81920.',
    },
  ];

  const handleInject = async () => {
    if (!smsText.trim()) return;
    setIsSubmitting(true);
    setLastResult(null);

    try {
      const res = await simulateIncomingSms(smsText, sender);
      setLastResult({
        sms: res.sms,
        reconciledCount: res.autoReconciled.length,
        reconciledOrders: res.autoReconciled.map((r) => r.orderId),
      });
      onSmsInjected(res.sms, res.autoReconciled);
    } catch (err: any) {
      alert(err.message || 'Error injecting SMS');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Bank SMS Feed Simulator</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulates real-time incoming SMS webhook from your merchant bank account
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="my-4">
          <label className="text-xs font-medium text-slate-300 block mb-2">Preset Bank SMS Templates:</label>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSender(preset.sender);
                  setSmsText(preset.text);
                }}
                className="text-left p-2 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-slate-700 transition-colors text-xs text-slate-300"
              >
                <div className="font-medium text-cyan-300">{preset.label}</div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{preset.sender}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form Controls */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Bank SMS Sender / Gateway:</label>
            <input
              type="text"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Raw SMS Message Body:</label>
            <textarea
              rows={3}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-2.5 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. SCB Easy: Money in +THB 150.00 to a/c x2834..."
            />
          </div>
        </div>

        {/* Result notification */}
        {lastResult && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-200">
            <div className="flex items-center gap-2 font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>SMS Ingested Successfully ({lastResult.sms?.id})</span>
            </div>
            {lastResult.reconciledCount && lastResult.reconciledCount > 0 ? (
              <p className="mt-1 text-emerald-300">
                ⚡ <strong>Instant Auto-Reconciliation:</strong> Triggered automatic approval for order(s):{' '}
                <span className="font-mono">{lastResult.reconciledOrders?.join(', ')}</span>!
              </p>
            ) : (
              <p className="mt-1 text-slate-400">
                Parsed Amount: {lastResult.sms?.parsedAmount} {lastResult.sms?.parsedCurrency} · Account: ...
                {lastResult.sms?.parsedAccountSuffix}. Stored as unclaimed credit entry.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isSubmitting || !smsText.trim()}
            onClick={handleInject}
            className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Processing...' : 'Inject & Reconcile'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
