import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { TopBar } from './components/TopBar';
import { Workbench } from './components/Workbench';
import { SubmissionsQueue } from './components/SubmissionsQueue';
import { SmsFeedView } from './components/SmsFeedView';
import { ScenarioLab } from './components/ScenarioLab';
import { AuditLogView } from './components/AuditLogView';
import { ConfigView } from './components/ConfigView';
import { ReportView } from './components/ReportView';
import { SmsSimulatorModal } from './components/SmsSimulatorModal';
import { SlipImageModal } from './components/SlipImageModal';
import { ManualOverrideModal } from './components/ManualOverrideModal';
import {
  fetchOrders,
  fetchSubmissions,
  fetchSmsFeed,
  fetchAuditLogs,
  fetchScenarios,
  fetchMerchantConfig,
  resetDatabase,
} from './services/api';
import {
  Order,
  Submission,
  BankSMS,
  AuditLog,
  MerchantConfig,
  TestScenario,
} from './types/payment';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'workbench' | 'submissions' | 'sms' | 'scenarios' | 'audit' | 'config' | 'report'
  >('workbench');

  const [orders, setOrders] = useState<Order[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [smsList, setSmsList] = useState<BankSMS[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [merchantConfig, setMerchantConfig] = useState<MerchantConfig | null>(null);

  const [selectedOrderId, setSelectedOrderId] = useState<string>('ORD-8491');
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [inspectedSubmission, setInspectedSubmission] = useState<Submission | null>(null);
  const [overrideSubmission, setOverrideSubmission] = useState<Submission | null>(null);
  const [bannerAlert, setBannerAlert] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const loadAllData = async () => {
    try {
      const [o, s, sms, logs, sc, cfg] = await Promise.all([
        fetchOrders(),
        fetchSubmissions(),
        fetchSmsFeed(),
        fetchAuditLogs(),
        fetchScenarios(),
        fetchMerchantConfig(),
      ]);
      setOrders(o);
      setSubmissions(s);
      setSmsList(sms);
      setAuditLogs(logs);
      setScenarios(sc);
      setMerchantConfig(cfg);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleResetData = async () => {
    if (window.confirm('Reset database to default seed state with fresh test orders and SMS feed?')) {
      await resetDatabase();
      await loadAllData();
      setBannerAlert({
        message: 'System database restored to default seed state.',
        type: 'info',
      });
      setTimeout(() => setBannerAlert(null), 3000);
    }
  };

  const handleSubmissionComplete = (newSub: Submission) => {
    setSubmissions((prev) => [newSub, ...prev.filter((s) => s.id !== newSub.id)]);
    // Refresh orders and logs to sync updated statuses
    loadAllData();
  };

  const handleSmsInjected = (
    newSms: BankSMS,
    autoReconciled: Array<{ orderId: string; submissionId: string }>
  ) => {
    setSmsList((prev) => [newSms, ...prev]);
    loadAllData();
    if (autoReconciled.length > 0) {
      setBannerAlert({
        message: `⚡ Bank SMS ${newSms.id} automatically resolved and approved order(s): ${autoReconciled
          .map((r) => r.orderId)
          .join(', ')}!`,
        type: 'success',
      });
      setTimeout(() => setBannerAlert(null), 5000);
    }
  };

  const handleScenarioSelected = (scenario: TestScenario, autoRun?: boolean) => {
    setSelectedOrderId(scenario.orderId);
    setActiveTab('workbench');
  };

  // High-level system statistics
  const totalSubmissions = submissions.length;
  const approvedCount = submissions.filter((s) => s.status === 'APPROVED').length;
  const pendingCount = submissions.filter((s) => s.status === 'NEEDS_VERIFICATION').length;
  const rejectedCount = submissions.filter((s) => s.status === 'REJECTED').length;
  const zeroCostCount = submissions.filter(
    (s) => s.verification.stages.find((st) => st.stage === 1 && st.status === 'FAILED')
  ).length;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Bar Navigation */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSmsSimulator={() => setIsSmsModalOpen(true)}
        onResetData={handleResetData}
        pendingCount={pendingCount}
      />

      {/* Real-time Banner Alert if trigger fired */}
      {bannerAlert && (
        <div
          className={`border-b px-4 py-2 text-center text-xs font-medium transition-all ${
            bannerAlert.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/80 text-emerald-200'
              : 'border-cyan-500/30 bg-cyan-950/80 text-cyan-200'
          }`}
        >
          {bannerAlert.message}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Metric Telemetry Strip (Quiet & Tabular) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Automated Approval Rate
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-emerald-400 tabular-nums">
                {totalSubmissions > 0 ? `${Math.round((approvedCount / totalSubmissions) * 100)}%` : '98.4%'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                ({approvedCount} approved)
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending Bank SMS Match
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-amber-400 tabular-nums">
                {pendingCount}
              </span>
              <span className="text-[11px] text-slate-500">queue</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Fraud &amp; Tamper Blocked
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-rose-400 tabular-nums">
                {rejectedCount}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                ({zeroCostCount} zero-cost drops)
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Bank Ingestion Feeds
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-cyan-400 tabular-nums">
                {smsList.length}
              </span>
              <span className="text-[11px] text-slate-500">
                ({smsList.filter((s) => !s.claimedByOrderId).length} unclaimed credits)
              </span>
            </div>
          </div>
        </section>

        {/* Tab Views */}
        {activeTab === 'workbench' && (
          <Workbench
            orders={orders}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            scenarios={scenarios}
            onSubmissionComplete={handleSubmissionComplete}
            onInspectSubmission={(sub) => setInspectedSubmission(sub)}
          />
        )}

        {activeTab === 'submissions' && (
          <SubmissionsQueue
            submissions={submissions}
            onInspect={(sub) => setInspectedSubmission(sub)}
            onOpenOverride={(sub) => setOverrideSubmission(sub)}
          />
        )}

        {activeTab === 'sms' && (
          <SmsFeedView
            smsList={smsList}
            onOpenSimulator={() => setIsSmsModalOpen(true)}
          />
        )}

        {activeTab === 'scenarios' && (
          <ScenarioLab
            scenarios={scenarios}
            onSelectScenario={handleScenarioSelected}
          />
        )}

        {activeTab === 'audit' && <AuditLogView logs={auditLogs} />}

        {activeTab === 'config' && (
          <ConfigView
            config={merchantConfig}
            onConfigUpdated={(cfg) => setMerchantConfig(cfg)}
          />
        )}

        {activeTab === 'report' && <ReportView />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            PayVerify Bank Payment Verification &amp; Fraud Defense Engine · 4-Stage Reconciliation Architecture
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>SHA-256 Pre-Check</span>
            <span>·</span>
            <span>Gemini 3.8 Flash OCR</span>
            <span>·</span>
            <span>Live SMS Webhook Ingestion</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SmsSimulatorModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        onSmsInjected={handleSmsInjected}
      />

      <SlipImageModal
        submission={inspectedSubmission}
        onClose={() => setInspectedSubmission(null)}
      />

      <ManualOverrideModal
        submission={overrideSubmission}
        onClose={() => setOverrideSubmission(null)}
        onOverrideSuccess={(updated) => {
          setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          loadAllData();
        }}
      />
    </div>
  );
}
