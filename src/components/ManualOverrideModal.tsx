import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, UserCheck } from 'lucide-react';
import { Submission } from '../types/payment';
import { submitManualOverride } from '../services/api';

interface ManualOverrideModalProps {
  submission: Submission | null;
  onClose: () => void;
  onOverrideSuccess: (updated: Submission) => void;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  submission,
  onClose,
  onOverrideSuccess,
}) => {
  const [staffName, setStaffName] = useState('Sarah Jenkins (Payment Ops)');
  const [targetStatus, setTargetStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reason, setReason] = useState(
    'Customer confirmed wire transfer via direct bank ledger portal; cleared funds verified manually.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!submission) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      const updated = await submitManualOverride(submission.id, staffName, targetStatus, reason);
      onOverrideSuccess(updated);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to submit manual override');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">Compliance Staff Manual Override</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
            <div className="flex justify-between font-mono text-[11px] text-slate-400 mb-1">
              <span>Submission: {submission.id}</span>
              <span>Order: #{submission.orderId}</span>
            </div>
            <div>Current Automated Status: <strong className="text-white">{submission.status}</strong></div>
            <div className="text-slate-400 mt-0.5">
              Automated Note: {submission.verification.internalNote || 'None'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Reviewing Staff Member:</label>
            <input
              type="text"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Override Decision:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetStatus('APPROVED')}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-colors ${
                  targetStatus === 'APPROVED'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                Force Approve Order
              </button>
              <button
                type="button"
                onClick={() => setTargetStatus('REJECTED')}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-colors ${
                  targetStatus === 'REJECTED'
                    ? 'border-rose-500 bg-rose-950/40 text-rose-200'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                Force Reject Slip
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Auditable Compliance Justification:
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clear operational verification justification for audit trail..."
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-2.5 font-sans text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              * This override will be permanently written to the immutable audit log with your signature.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Recording Override...' : 'Apply & Sign Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
