'use client';
import { useState } from 'react';
import AnalyticsPage from '../analytics/page';
import RecordsPage from '../records/page';

const TABS = [
  { id: 'analytics', label: 'Analytics',    icon: '📊' },
  { id: 'records',   label: 'Past Records', icon: '📁' },
] as const;

type Tab = typeof TABS[number]['id'];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('analytics');

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Reports & Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Incident analytics and historical records</p>
      </div>

      <div className="flex border-b border-slate-700 overflow-x-auto no-scrollbar mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'text-white border-b-2 border-red-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div>
        {tab === 'analytics' && <AnalyticsPage />}
        {tab === 'records'   && <RecordsPage />}
      </div>
    </div>
  );
}
