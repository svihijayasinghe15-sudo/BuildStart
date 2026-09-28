import React, { useState, useRef } from 'react';
import {
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  FileText,
  Eye,
  Info,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Order, Submission, TestScenario } from '../types/payment';
import { verifySlip } from '../services/api';

interface WorkbenchProps {
  orders: Order[];
  selectedOrderId: string;
  setSelectedOrderId: (id: string) => void;
  scenarios: TestScenario[];
  onSubmissionComplete: (submission: Submission) => void;
  onInspectSubmission: (submission: Submission) => void;
}

export const Workbench: React.FC<WorkbenchProps> = ({
  orders,
  selectedOrderId,
  setSelectedOrderId,
  scenarios,
  onSubmissionComplete,
  onInspectSubmission,
}) => {
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.name.endsWith('.svg')) {
      setUploadError('Please select a valid image file (PNG, JPEG, WebP, SVG)');
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSlipImage(dataUrl);
      setActiveSubmission(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectScenario = (scenario: TestScenario) => {
    setSelectedOrderId(scenario.orderId);
    setSlipImage(scenario.slipImageDataUrl);
    setActiveSubmission(null);
    setUploadError(null);
  };

  const handleRunPipeline = async () => {
    if (!selectedOrder || !slipImage) return;

    setIsVerifying(true);
    setUploadError(null);

    try {
      const submission = await verifySlip(selectedOrder.id, slipImage);
      setActiveSubmission(submission);
      onSubmissionComplete(submission);
    } catch (err: any) {
      setUploadError(err.message || 'Pipeline execution failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Helper for status colors
  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'APPROVED':
        return {
          bg: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
          label: 'APPROVED',
        };
      case 'NEEDS_VERIFICATION':
        return {
          bg: 'bg-amber-950/40 border-amber-500/40 text-amber-300',
          icon: <Clock className="h-4 w-4 text-amber-400" />,
          label: 'NEEDS VERIFICATION (Pending Bank Feed)',
        };
      case 'REJECTED':
      default:
        return {
          bg: 'bg-rose-950/40 border-rose-500/40 text-rose-300',
          icon: <XCircle className="h-4 w-4 text-rose-400" />,
          label: 'REJECTED (Fraud / Rule Flagged)',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Order Context & Ingestion */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Order Selector & Parameters */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Target Order Selection
              </span>
              <span className="text-[11px] font-mono text-cyan-400">
                {orders.filter((o) => o.status === 'PENDING_PAYMENT').length} Unsettled
              </span>
            </div>

            {/* Order dropdown */}
            <div className="mt-4">
              <label className="text-xs text-slate-400 block mb-1.5">Select Order to Reconcile:</label>
              <select
                value={selectedOrderId}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  setActiveSubmission(null);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-white focus:border-cyan-500 focus:outline-none"
              >
                {orders.map((ord) => (
                  <option key={ord.id} value={ord.id}>
                    {ord.id} · {ord.customerName} · {ord.amount.toFixed(2)} {ord.currency} [{ord.status}]
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Order Summary Card */}
            {selectedOrder && (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="font-semibold text-white">{selectedOrder.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Required Amount:</span>
                  <span className="font-mono font-bold text-cyan-300 text-sm">
                    {selectedOrder.amount.toFixed(2)} {selectedOrder.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Merchant Account:</span>
                  <span className="font-mono text-slate-300">
                    {selectedOrder.targetBank} ({selectedOrder.targetAccount})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Item:</span>
                  <span className="text-slate-300 truncate max-w-[170px]" title={selectedOrder.itemDescription}>
                    {selectedOrder.itemDescription}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                  <span className="text-slate-400">Status:</span>
                  <span
                    className={`font-mono text-[11px] font-medium ${
                      selectedOrder.status === 'APPROVED'
                        ? 'text-emerald-400'
                        : selectedOrder.status === 'NEEDS_VERIFICATION'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
              </div>
            )}

            {/* Fast Presets from Scenarios */}
            <div className="mt-5 border-t border-slate-800 pt-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                1-Click Preset Test Slips:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {scenarios.slice(0, 6).map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => handleSelectScenario(sc)}
                    className="p-1.5 rounded border border-slate-800 bg-slate-950 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-colors text-left"
                  >
                    <div className="text-[11px] font-medium text-slate-200 truncate">{sc.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{sc.expectedDecision}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right Column: Slip Image Upload & Action */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Bank Transfer Slip Image Ingestion
              </span>
              {slipImage && (
                <button
                  onClick={() => setSlipImage(null)}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                >
                  Clear Image
                </button>
              )}
            </div>

            {/* Upload Box / Dropzone */}
            <div className="mt-4">
              {!slipImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/40 p-8 text-center hover:border-cyan-500 hover:bg-slate-950/80 transition-all cursor-pointer group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-slate-400 group-hover:text-cyan-400 group-hover:scale-105 transition-all">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-200">
                    Click to upload bank transfer slip or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Supports PNG, JPEG, SVG electronic slips (max 20MB)
                  </p>
                  <p className="mt-3 text-[11px] text-cyan-400/80 font-mono">
                    Or select a 1-click test preset from the left panel
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.svg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  {/* Thumbnail */}
                  <div className="relative h-44 w-36 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center">
                    <img
                      src={slipImage}
                      alt="Uploaded Slip"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  {/* Details & Trigger button */}
                  <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Slip Ready for Verification</span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-cyan-400 hover:underline"
                      >
                        Replace Image
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      The automated 4-stage engine will run SHA-256 deduplication, Gemini multimodal tamper extraction,
                      and cross-reconcile with real-time bank SMS feeds.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.svg"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="pt-2">
                      <button
                        disabled={isVerifying}
                        onClick={handleRunPipeline}
                        className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-cyan-900/30 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isVerifying ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin text-white" />
                            <span>Executing 4-Stage Fraud Pipeline...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4 text-white" />
                            <span>Run Auto-Verification Pipeline</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/30 p-2.5 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4-Stage Architecture Pipeline Status */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              4-Stage Verification Pipeline Architecture
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Zero-cost pre-filter &gt; Multimodal OCR &gt; Fraud &amp; Rule Engine &gt; Bank Feed Reconciliation
            </p>
          </div>
          {activeSubmission && (
            <span className="text-[11px] font-mono text-slate-400">
              Total Execution: {activeSubmission.verification.stages.reduce((acc, s) => acc + s.executionTimeMs, 0)}ms
            </span>
          )}
        </div>

        {/* Pipeline Step Cards */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              stage: 1,
              title: 'Stage 1: Zero-Cost SHA Pre-Check',
              desc: 'Identical hash deduplication registry. Stops re-used slips with 0 AI cost.',
            },
            {
              stage: 2,
              title: 'Stage 2: Gemini Multimodal OCR',
              desc: 'Extracts amount, ref, account, and inspects pixel noise/tamper artifacts.',
            },
            {
              stage: 3,
              title: 'Stage 3: Fraud & Rule Engine',
              desc: 'Verifies account match, amount accuracy, reference collision, and date.',
            },
            {
              stage: 4,
              title: 'Stage 4: Bank SMS Cross-Reconciliation',
              desc: 'Matches and claims real-time bank SMS notifications from bank gateway.',
            },
          ].map((item) => {
            const stageOutcome = activeSubmission?.verification.stages.find(
              (s) => s.stage === item.stage
            );

            let statusColor = 'border-slate-800 bg-slate-950/60 text-slate-400';
            let statusBadge = 'STANDBY';

            if (isVerifying) {
              statusColor = 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300 animate-pulse';
              statusBadge = 'ANALYZING...';
            } else if (stageOutcome) {
              if (stageOutcome.status === 'PASSED') {
                statusColor = 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300';
                statusBadge = 'PASSED';
              } else if (stageOutcome.status === 'FAILED') {
                statusColor = 'border-rose-500/40 bg-rose-950/20 text-rose-300';
                statusBadge = 'FAILED / REJECTED';
              } else if (stageOutcome.status === 'PENDING') {
                statusColor = 'border-amber-500/40 bg-amber-950/20 text-amber-300';
                statusBadge = 'PENDING FEED';
              } else if (stageOutcome.status === 'SKIPPED') {
                statusColor = 'border-slate-800 bg-slate-950/30 text-slate-600';
                statusBadge = 'SKIPPED (0 Tokens)';
              }
            }

            return (
              <div
                key={item.stage}
                className={`relative flex flex-col justify-between rounded-lg border p-3.5 transition-all ${statusColor}`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span>{statusBadge}</span>
                    {stageOutcome && (
                      <span className="text-[10px] text-slate-500">
                        {stageOutcome.executionTimeMs}ms
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 text-xs font-semibold text-slate-200">{item.title}</h4>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                </div>

                {stageOutcome?.summary && (
                  <div className="mt-3 border-t border-slate-800/80 pt-2 text-[10px] font-mono text-slate-300 truncate">
                    {stageOutcome.summary}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Verification Result Breakdown Card (Displayed when execution is done) */}
      {activeSubmission && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Decision Hero Banner */}
          {(() => {
            const badge = getDecisionBadge(activeSubmission.status);
            return (
              <div
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 ${badge.bg}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-slate-950/60 border border-slate-800">
                    {badge.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tracking-tight">{badge.label}</span>
                      <span className="text-xs font-mono opacity-80">
                        (Confidence: {activeSubmission.verification.confidenceScore}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {activeSubmission.verification.rejectionReason ||
                        activeSubmission.verification.internalNote}
                    </p>
                  </div>
                </div>

                <div className="mt-3 sm:mt-0 flex items-center gap-2">
                  <button
                    onClick={() => onInspectSubmission(activeSubmission)}
                    className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Forensic Inspector</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Customer Facing Dispatch Message */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                Customer Notification Message Dispatched:
              </span>
              <span className="font-mono text-[10px] text-slate-500">Channel: SMS / Push / In-App</span>
            </div>
            <p className="text-xs font-mono text-cyan-200 bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
              "{activeSubmission.verification.customerMessage}"
            </p>
          </div>

          {/* Forensic Comparison Table */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Parameter Cross-Reconciliation Matrix
            </h4>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Field</th>
                    <th className="py-2.5 px-3">Expected (Order / Bank)</th>
                    <th className="py-2.5 px-3">Extracted (Slip OCR)</th>
                    <th className="py-2.5 px-3">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-200">
                  {/* Amount Row */}
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-slate-400">Total Amount</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-white">
                      {selectedOrder.amount.toFixed(2)} {selectedOrder.currency}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {activeSubmission.verification.extraction ? (
                        `${activeSubmission.verification.extraction.amount.toFixed(2)} ${activeSubmission.verification.extraction.currency}`
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {activeSubmission.verification.extraction?.amount === selectedOrder.amount ? (
                        <span className="text-emerald-400 font-mono text-[11px]">Exact Match</span>
                      ) : (
                        <span className="text-rose-400 font-mono text-[11px]">Discrepancy</span>
                      )}
                    </td>
                  </tr>

                  {/* Receiving Account Row */}
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-slate-400">Merchant Account</td>
                    <td className="py-2.5 px-3 font-mono text-cyan-300">{selectedOrder.targetAccount}</td>
                    <td className="py-2.5 px-3 font-mono">
                      {activeSubmission.verification.extraction?.recipientAccount || (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {activeSubmission.verification.rejectionCategory === 'ACCOUNT_MISMATCH' ? (
                        <span className="text-rose-400 font-mono text-[11px]">Account Mismatch</span>
                      ) : (
                        <span className="text-emerald-400 font-mono text-[11px]">Verified</span>
                      )}
                    </td>
                  </tr>

                  {/* Reference Code Row */}
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-slate-400">Transaction Ref</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">Must be unique</td>
                    <td className="py-2.5 px-3 font-mono text-white">
                      {activeSubmission.verification.extraction?.referenceNumber || (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {activeSubmission.verification.rejectionCategory === 'REUSED_REFERENCE' ? (
                        <span className="text-rose-400 font-mono text-[11px]">Collision Detected</span>
                      ) : (
                        <span className="text-emerald-400 font-mono text-[11px]">Unique Code</span>
                      )}
                    </td>
                  </tr>

                  {/* Tamper Score Row */}
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-slate-400">Tamper &amp; Forgery</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">Threshold &lt; 40%</td>
                    <td className="py-2.5 px-3 font-mono">
                      {activeSubmission.verification.extraction ? (
                        `${(activeSubmission.verification.extraction.tamperScore * 100).toFixed(0)}% Likelihood`
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {(activeSubmission.verification.extraction?.tamperScore || 0) >= 0.4 ? (
                        <span className="text-rose-400 font-mono text-[11px]">Manipulated</span>
                      ) : (
                        <span className="text-emerald-400 font-mono text-[11px]">Pristine</span>
                      )}
                    </td>
                  </tr>

                  {/* Bank SMS Match Row */}
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-slate-400">Bank SMS Confirmation</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">Real-Time Ingestion Feed</td>
                    <td className="py-2.5 px-3 font-mono">
                      {activeSubmission.verification.matchedSmsId ? (
                        <span className="text-emerald-300">
                          {activeSubmission.verification.matchedSmsId} ({activeSubmission.verification.matchedSms?.sender})
                        </span>
                      ) : (
                        <span className="text-amber-400">No Unclaimed Match Found</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {activeSubmission.verification.matchedSmsId ? (
                        <span className="text-emerald-400 font-mono text-[11px]">Reconciled &amp; Claimed</span>
                      ) : activeSubmission.status === 'NEEDS_VERIFICATION' ? (
                        <span className="text-amber-400 font-mono text-[11px]">Pending SMS Webhook</span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">N/A</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
