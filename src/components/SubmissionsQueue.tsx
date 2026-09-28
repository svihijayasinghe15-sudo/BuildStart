import React, { useState } from 'react';
import { Eye, UserCheck, ShieldAlert, CheckCircle2, Clock, XCircle, Search } from 'lucide-react';
import { Submission } from '../types/payment';

interface SubmissionsQueueProps {
  submissions: Submission[];
  onInspect: (submission: Submission) => void;
  onOpenOverride: (submission: Submission) => void;
}

export const SubmissionsQueue: React.FC<SubmissionsQueueProps> = ({
  submissions,
  onInspect,
  onOpenOverride,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'APPROVED' | 'NEEDS_VERIFICATION' | 'REJECTED'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = submissions.filter((s) => {
    if (filter !== 'ALL' && s.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.id.toLowerCase().includes(q) ||
        s.orderId.toLowerCase().includes(q) ||
        (s.verification.extraction?.referenceNumber &&
          s.verification.extraction.referenceNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case 'NEEDS_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Needs Verification
          </span>
        );
      case 'REJECTED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Interactive Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {(['ALL', 'NEEDS_VERIFICATION', 'APPROVED', 'REJECTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === tab
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'ALL'
                ? 'All Submissions'
                : tab === 'NEEDS_VERIFICATION'
                ? 'Needs Verification'
                : tab.charAt(0) + tab.slice(1).toLowerCase()}
              <span className="ml-1.5 text-[10px] opacity-60 font-mono">
                ({tab === 'ALL' ? submissions.length : submissions.filter((s) => s.status === tab).length})
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, Order, or Ref #..."
            className="w-full sm:w-64 rounded-lg border border-slate-800 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* High-Density Data Grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No payment slip submissions found matching current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-[11px] text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Submission ID</th>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Decision</th>
                  <th className="py-3 px-4">Reference Number</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filtered.map((sub) => {
                  const ext = sub.verification.extraction;
                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => onInspect(sub)}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-white">{sub.id}</td>
                      <td className="py-3 px-4 font-mono text-cyan-300">#{sub.orderId}</td>
                      <td className="py-3 px-4 font-mono font-bold text-white tabular-nums">
                        {ext ? `${ext.amount.toFixed(2)} ${ext.currency}` : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(sub.status)}
                          {sub.manualOverride && (
                            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                              Overridden
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {ext?.referenceNumber || sub.verification.rejectionCategory || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {sub.verification.confidenceScore}%
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(sub.submittedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onInspect(sub)}
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Inspect Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenOverride(sub)}
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
                            title="Staff Manual Override"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
