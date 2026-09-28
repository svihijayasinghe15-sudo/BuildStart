import React from 'react';
import { X, ZoomIn, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Submission } from '../types/payment';

interface SlipImageModalProps {
  submission: Submission | null;
  onClose: () => void;
}

export const SlipImageModal: React.FC<SlipImageModalProps> = ({ submission, onClose }) => {
  if (!submission) return null;

  const ext = submission.verification.extraction;
  const isApproved = submission.status === 'APPROVED';
  const isNeedsVerif = submission.status === 'NEEDS_VERIFICATION';
  const isRejected = submission.status === 'REJECTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">Slip Inspector & Forensic Detail</h3>
            <span className="text-xs text-slate-500 font-mono">ID: {submission.id}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">Order #{submission.orderId}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content body: side-by-side or stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 overflow-y-auto p-6 gap-6">
          {/* Slip Image Preview */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="relative max-h-[500px] w-full flex items-center justify-center overflow-hidden rounded">
              {submission.imageUrl.startsWith('data:image') ? (
                <img
                  src={submission.imageUrl}
                  alt="Bank Slip"
                  className="max-h-[480px] object-contain shadow-md rounded"
                />
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 font-mono">
                  [Binary Hash Payload: {submission.imageHash.slice(0, 24)}...]
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between w-full text-[11px] text-slate-500 font-mono">
              <span>SHA-256: {submission.imageHash.slice(0, 16)}...</span>
              <span>Submitted: {new Date(submission.submittedAt).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Forensic Details & OCR Extraction */}
          <div className="space-y-4">
            {/* Status card */}
            <div
              className={`rounded-lg p-4 border ${
                isApproved
                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
                  : isNeedsVerif
                  ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
                  : 'border-rose-500/30 bg-rose-950/20 text-rose-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Decision: {submission.status}
                </span>
                <span className="text-xs font-mono font-medium">
                  Confidence: {submission.verification.confidenceScore}%
                </span>
              </div>
              <p className="mt-1 text-xs">{submission.verification.customerMessage}</p>
              {submission.verification.internalNote && (
                <p className="mt-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                  Internal: {submission.verification.internalNote}
                </p>
              )}
            </div>

            {/* Extracted Fields */}
            {ext ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-semibold text-slate-300">Gemini OCR Extracted Parameters</h4>
                  <span className="text-[10px] text-slate-500 font-mono">{ext.modelUsed}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">TRANSFER AMOUNT</span>
                    <span className="font-mono font-semibold text-white">
                      {ext.amount.toFixed(2)} {ext.currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">ISSUING BANK</span>
                    <span className="font-medium text-slate-200">{ext.bankName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">RECIPIENT ACCOUNT</span>
                    <span className="font-mono font-medium text-cyan-300">{ext.recipientAccount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">REFERENCE NUMBER</span>
                    <span className="font-mono font-medium text-slate-200">{ext.referenceNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SENDER</span>
                    <span className="text-slate-300">{ext.senderName} ({ext.senderAccount})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">TRANSACTION TIME</span>
                    <span className="font-mono text-slate-400">{ext.transferDateTime}</span>
                  </div>
                </div>

                {/* Tamper Score */}
                <div className="border-t border-slate-800 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Forensic Tamper Score:</span>
                    <span
                      className={`font-mono font-semibold ${
                        ext.tamperScore > 0.4 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {(ext.tamperScore * 100).toFixed(0)}% Likelihood
                    </span>
                  </div>
                  {ext.tamperReasons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {ext.tamperReasons.map((reason, idx) => (
                        <li key={idx} className="text-[11px] text-rose-300 flex items-start gap-1.5">
                          <span className="text-rose-500 mt-0.5">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-500">
                Extraction bypassed or failed at early pipeline stage.
              </div>
            )}

            {/* Stages overview */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                4-Stage Pipeline Breakdown
              </h4>
              <div className="space-y-1.5">
                {submission.verification.stages.map((stage) => (
                  <div
                    key={stage.stage}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40 last:border-none"
                  >
                    <span className="text-slate-300">
                      Stage {stage.stage}: {stage.name}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        stage.status === 'PASSED'
                          ? 'text-emerald-400'
                          : stage.status === 'FAILED'
                          ? 'text-rose-400'
                          : stage.status === 'PENDING'
                          ? 'text-amber-400'
                          : 'text-slate-600'
                      }`}
                    >
                      {stage.status} ({stage.executionTimeMs}ms)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
