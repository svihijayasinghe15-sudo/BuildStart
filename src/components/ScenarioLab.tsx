import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Clock, ShieldCheck, AlertTriangle, ArrowRight, Filter } from 'lucide-react';
import { TestScenario } from '../types/payment';

interface ScenarioLabProps {
  scenarios: TestScenario[];
  onSelectScenario: (scenario: TestScenario, autoRun?: boolean) => void;
}

export const ScenarioLab: React.FC<ScenarioLabProps> = ({
  scenarios,
  onSelectScenario,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const categories = ['ALL', 'Golden Path', 'Rule Engine', 'Fraud Defense', 'Uncertainty Handling', 'Cross-Reconciliation', 'Anti-False-Attribution'];

  const filteredScenarios = scenarios.filter((sc) => {
    if (selectedFilter === 'ALL') return true;
    return sc.category.toLowerCase() === selectedFilter.toLowerCase();
  });

  const getExpectedBadge = (decision: string) => {
    switch (decision) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
            Expected: APPROVED
          </span>
        );
      case 'NEEDS_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
            Expected: NEEDS VERIFICATION
          </span>
        );
      case 'REJECTED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
            Expected: REJECTED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>COMPREHENSIVE TEST LAB</span>
              <span>·</span>
              <span>12 OPERATIONAL SITUATIONS</span>
            </div>
            <h3 className="text-base font-semibold text-white">Full Operational Validation Suite</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Verifies normal payments, wrong amounts, wrong accounts, duplicate slips, reused payments,
              differing image crops, old/stale slips, edited/manipulated receipts, unclear images,
              conflicting evidence, missing evidence, and multi-customer payment disambiguation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-cyan-950/60 border border-cyan-800/50 px-3 py-1.5 text-xs font-mono text-cyan-300">
              {scenarios.length} Test Vectors Ready
            </span>
          </div>
        </div>

        {/* Category Filters */}
        <div className="mt-4 flex items-center gap-1.5 flex-wrap border-t border-slate-800 pt-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedFilter(cat)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedFilter === cat
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredScenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 transition-all space-y-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                  {scenario.situation}
                </span>
                {getExpectedBadge(scenario.expectedDecision)}
              </div>

              <h4 className="mt-2 text-sm font-semibold text-white">{scenario.title}</h4>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{scenario.description}</p>

              <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 text-[11px] font-mono text-slate-400">
                <div className="text-slate-300 truncate">
                  Target: #{scenario.orderId} · {scenario.slipDescription}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-slate-500">Category: {scenario.category}</span>
                  {scenario.expectedStageFailure && (
                    <span className="text-rose-400">
                      Evaluated at Stage {scenario.expectedStageFailure}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <button
                onClick={() => onSelectScenario(scenario, false)}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Inspect Vector
              </button>

              <button
                onClick={() => onSelectScenario(scenario, true)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Run Scenario</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
