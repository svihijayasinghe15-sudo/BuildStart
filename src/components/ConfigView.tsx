import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, Building, ShieldAlert } from 'lucide-react';
import { MerchantConfig } from '../types/payment';
import { updateMerchantConfig } from '../services/api';

interface ConfigViewProps {
  config: MerchantConfig | null;
  onConfigUpdated: (cfg: MerchantConfig) => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ config, onConfigUpdated }) => {
  if (!config) return null;

  const [requireSms, setRequireSms] = useState(config.requireSmsReconciliation);
  const [tamperThreshold, setTamperThreshold] = useState(config.tamperScoreThreshold);
  const [staleMinutes, setStaleMinutes] = useState(config.staleMinutesThreshold);
  const [allowRounding, setAllowRounding] = useState(config.allowMinorCentsRounding);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await updateMerchantConfig({
      requireSmsReconciliation: requireSms,
      tamperScoreThreshold: tamperThreshold,
      staleMinutesThreshold: staleMinutes,
      allowMinorCentsRounding: allowRounding,
    });
    onConfigUpdated(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-white">Merchant Payment Routing &amp; Bank Accounts</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Authorized receiving deposit accounts verified by Stage 3 receiving account check
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {config.authorizedAccounts.map((acc, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white flex items-center gap-2">
                  <Building className="h-4 w-4 text-cyan-400" />
                  {acc.bankName}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-slate-300">
                <span className="text-slate-500">Account #:</span>
                <span className="text-cyan-300 font-bold">{acc.accountNumber}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Account Suffix:</span>
                <span className="font-mono text-white">...{acc.accountSuffix}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Beneficiary:</span>
                <span className="text-slate-200">{acc.accountHolder}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-white">4-Stage Pipeline Policy Rules</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure automated strictness, tamper sensitivity, and cross-reconciliation requirements
          </p>
        </div>

        <div className="space-y-4 text-xs">
          {/* SMS requirement */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-800 bg-slate-950/40">
            <div>
              <span className="font-medium text-white block">Require Live Bank SMS Reconciliation (Stage 4)</span>
              <span className="text-slate-400 block mt-0.5">
                When enabled, slips that pass Stages 1-3 enter 'NEEDS_VERIFICATION' until an unclaimed matching bank SMS arrives.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={requireSms}
                onChange={(e) => setRequireSms(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
          </div>

          {/* Tamper Score Slider */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/40 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-white block">Forensic Tamper Score Threshold (Stage 3)</span>
                <span className="text-slate-400 block mt-0.5">
                  Slips exceeding this tamper likelihood score are immediately rejected for digital manipulation.
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-cyan-400">
                {(tamperThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={tamperThreshold}
              onChange={(e) => setTamperThreshold(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Stale Minutes */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div>
              <span className="font-medium text-white block">Maximum Stale Transfer Window</span>
              <span className="text-slate-400 block mt-0.5">
                Maximum allowed age between slip transfer timestamp and order creation.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={staleMinutes}
                onChange={(e) => setStaleMinutes(parseInt(e.target.value, 10))}
                className="w-24 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-white text-right focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-slate-400 text-xs">minutes</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          {isSaved ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Settings saved and active
            </span>
          ) : (
            <span className="text-xs text-slate-500">Changes take effect immediately on next verification.</span>
          )}

          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
