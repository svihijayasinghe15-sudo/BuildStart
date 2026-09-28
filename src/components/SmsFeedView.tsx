import React from 'react';
import { MessageSquare, CheckCircle2, Clock, Plus, ExternalLink, ShieldCheck } from 'lucide-react';
import { BankSMS } from '../types/payment';

interface SmsFeedViewProps {
  smsList: BankSMS[];
  onOpenSimulator: () => void;
}

export const SmsFeedView: React.FC<SmsFeedViewProps> = ({ smsList, onOpenSimulator }) => {
  return (
    <div className="space-y-4">
      {/* Header and Ingest CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Bank SMS &amp; Webhook Notification Ingestion Feed</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Incoming real-time credit alerts from Kasikornbank, SCB, and clearing gateways
          </p>
        </div>
        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-500 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Simulate Incoming SMS</span>
        </button>
      </div>

      {/* Grid of SMS cards / Feed Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 shadow-sm overflow-hidden">
        {smsList.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No bank SMS records in feed. Click 'Simulate Incoming SMS' to test!
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {smsList.map((sms) => {
              const isClaimed = Boolean(sms.claimedByOrderId);
              return (
                <div
                  key={sms.id}
                  className="p-4 hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                        {sms.sender}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">ID: {sms.id}</span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(sms.receivedAt).toLocaleTimeString()}
                      </span>
                      <span className="text-xs text-slate-500">·</span>
                      {isClaimed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                          <CheckCircle2 className="h-3 w-3" />
                          Reconciled with #{sms.claimedByOrderId}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
                          <Clock className="h-3 w-3" />
                          Unclaimed Credit · Ready to Match
                        </span>
                      )}
                    </div>

                    {/* Raw text */}
                    <p className="font-mono text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded border border-slate-800/60 leading-relaxed">
                      {sms.rawText}
                    </p>
                  </div>

                  {/* Parsed Attributes */}
                  <div className="md:w-64 shrink-0 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Parsed Credit:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        +{sms.parsedAmount.toFixed(2)} {sms.parsedCurrency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Account Suffix:</span>
                      <span className="font-mono text-cyan-300">...{sms.parsedAccountSuffix || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Parsed Ref:</span>
                      <span className="font-mono text-slate-300 truncate max-w-[130px]">
                        {sms.parsedRef || 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
