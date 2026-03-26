'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { SensorDevice } from '../../../../../shared/types';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 10) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function BatteryBar({ level }: { level: number | null }) {
  if (level === null) return <span className="text-slate-500 text-xs">N/A</span>;
  const color = level > 50 ? 'bg-green-500' : level > 20 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${level}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8">{level}%</span>
    </div>
  );
}

function SignalIcon({ strength }: { strength: number | null }) {
  if (strength === null) return <span className="text-slate-500 text-xs">N/A</span>;
  const label = strength > 70 ? 'Strong' : strength > 40 ? 'Medium' : 'Weak';
  const color = strength > 70 ? 'text-green-400' : strength > 40 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-xs font-medium ${color}`}>📶 {label}</span>;
}

export default function SensorHealthPage() {
  const { workspaceId } = useAdminWorkspace();
  const [sensors, setSensors] = useState<SensorDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from('sensor_devices').select('*').eq('workspace_id', workspaceId)
      .then(({ data }) => { setSensors((data ?? []) as SensorDevice[]); setLoading(false); });

    const ch = supabase.channel('health-sensors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensor_devices' }, () => {
        supabase.from('sensor_devices').select('*').eq('workspace_id', workspaceId)
          .then(({ data }) => setSensors((data ?? []) as SensorDevice[]));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);

  const offlineSensors = sensors.filter((s) => s.status === 'offline');

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Sensor Health</h1>

      {offlineSensors.map((s) => (
        <div key={s.id} className="bg-red-950/60 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
          ⚠️ Sensor <span className="font-mono font-bold">{s.device_id}</span> is offline. Zone {s.zone_id} may be unmonitored.
        </div>
      ))}

      {sensors.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
          No sensors registered yet.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sensors.map((s) => (
          <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-mono text-sm font-semibold">{s.device_id}</p>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full mt-1 inline-block">
                  Zone {s.zone_id}
                </span>
              </div>
              <div className={`w-4 h-4 rounded-full ${
                s.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-500'
              }`} />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Last seen</span>
                <span>{timeAgo(s.last_ping)}</span>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Battery</p>
                <BatteryBar level={s.battery_level} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Signal</span>
                <SignalIcon strength={s.signal_strength} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
