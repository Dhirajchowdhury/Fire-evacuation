'use client';
import { useState } from 'react';
import EmergencyPage from '../emergency/page';
import AnnouncementsPage from '../announcements/page';
import DrillsPage from '../drills/page';

const TABS = [
  { id: 'emergency',      label: 'Emergency Trigger', icon: '🆘' },
  { id: 'announcements',  label: 'Announcements',     icon: '📢' },
  { id: 'drills',         label: 'Drill Mode',        icon: '🧪' },
] as const;

type Tab = typeof TABS[number]['id'];

export default function EmergencyHubPage() {
  const [tab, setTab] = useState<Tab>('emergency');

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Emergency</h1>
        <p className="text-slate-500 text-sm mt-0.5">Trigger alerts, broadcast messages, run drills</p>
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
        {tab === 'emergency'     && <EmergencyPage />}
        {tab === 'announcements' && <AnnouncementsPage />}
        {tab === 'drills'        && <DrillsPage />}
      </div>
    </div>
  );
}
