import React from 'react';
import { ShieldCheck, MessageSquarePlus, RotateCcw, Activity } from 'lucide-react';

interface TopBarProps {
  activeTab: 'workbench' | 'submissions' | 'sms' | 'scenarios' | 'audit' | 'config' | 'report';
  setActiveTab: (tab: 'workbench' | 'submissions' | 'sms' | 'scenarios' | 'audit' | 'config' | 'report') => void;
  onOpenSmsSimulator: () => void;
  onResetData: () => void;
  pendingCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSmsSimulator,
  onResetData,
  pendingCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('workbench');
            }}
            className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white hover:text-slate-200 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-sm shadow-cyan-500/20">
              <ShieldCheck className="h-4 w-4 text-slate-950 stroke-[2.5]" />
            </div>
            <span>PayVerify</span>
          </a>
        </div>

        {/* Zone 2: Navigation Links (Single-Line segmented control) */}
        <nav className="hidden md:flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800">
          <button
            onClick={() => setActiveTab('workbench')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'workbench'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Verification Workbench
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'submissions'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Submissions Queue</span>
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'sms'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bank SMS Stream
          </button>
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'scenarios'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Scenario Lab
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Trail
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'config'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            System Report
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSmsSimulator}
            className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-colors whitespace-nowrap"
            title="Inject an incoming bank SMS to trigger instant auto-reconciliation"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Simulate Bank SMS</span>
            <span className="sm:hidden">SMS</span>
          </button>

          <button
            onClick={onResetData}
            className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
            title="Reset database to default seed records"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
