'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import SensorsPage from '../sensors/page';
import SensorHealthPage from '../health/page';
import OccupancyPage from '../occupancy/page';
import AlertsPage from '../alerts/page';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';

const ESP32SimPanel = dynamic(() => import('../../../../components/dashboard/ESP32SimPanel'), { ssr: false });

const TABS = [
  { id: 'sensors',   label: 'Sensors',       icon: '📡' },
  { id: 'health',    label: 'Sensor Health',  icon: '💚' },
  { id: 'occupancy', label: 'Occupancy',      icon: '🌡️' },
  { id: 'alerts',    label: 'Live Alerts',    icon: '🚨' },
  { id: 'esp32',     label: 'ESP32 Simulator',icon: '🔌' },
] as const;

type Tab = typeof TABS[number]['id'];

export default function MonitoringPage() {
  const [tab, setTab] = useState<Tab>('sensors');
  const { workspaceId } = useAdminWorkspace();

  return (
    <div className="space-y-0">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Monitoring</h1>
        <p className="text-slate-500 text-sm mt-0.5">Sensors, health, occupancy, alerts and ESP32 simulation</p>
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
        {tab === 'sensors'   && <SensorsPage />}
        {tab === 'health'    && <SensorHealthPage />}
        {tab === 'occupancy' && <OccupancyPage />}
        {tab === 'alerts'    && <AlertsPage />}
        {tab === 'esp32'     && workspaceId && <ESP32SimPanel workspaceId={workspaceId} />}
        {tab === 'esp32'     && !workspaceId && (
          <p className="text-slate-500 text-sm">Loading workspace...</p>
        )}
      </div>
    </div>
  );
}
