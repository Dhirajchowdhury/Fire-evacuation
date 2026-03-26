'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { SensorDevice } from '../../../../../shared/types';

type ZoneId = 'A' | 'B' | 'C' | 'D';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 10) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function SensorsPage() {
  const { workspaceId } = useAdminWorkspace();
  const [sensors, setSensors]   = useState<SensorDevice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSensor, setEditSensor] = useState<SensorDevice | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [zone, setZone]         = useState<ZoneId>('A');
  const [saving, setSaving]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from('sensor_devices').select('*').eq('workspace_id', workspaceId)
      .then(({ data }) => { setSensors((data ?? []) as SensorDevice[]); setLoading(false); });
  }, [workspaceId]);

  async function handleSave() {
    if (!workspaceId || !deviceId.trim()) return;
    setSaving(true);
    if (editSensor) {
      const { error } = await supabase.from('sensor_devices')
        .update({ zone_id: zone }).eq('id', editSensor.id);
      if (!error) setSensors((prev) => prev.map((s) => s.id === editSensor.id ? { ...s, zone_id: zone } : s));
    } else {
      const { data, error } = await supabase.from('sensor_devices')
        .insert({ workspace_id: workspaceId, device_id: deviceId.trim(), zone_id: zone, status: 'online' })
        .select().single();
      if (!error && data) setSensors((prev) => [...prev, data as SensorDevice]);
    }
    setSaving(false); setShowModal(false); setDeviceId(''); setEditSensor(null);
    showToast(editSensor ? 'Sensor updated.' : 'Sensor added.');
  }

  async function handleDelete(id: string) {
    await supabase.from('sensor_devices').delete().eq('id', id);
    setSensors((prev) => prev.filter((s) => s.id !== id));
    setConfirmDelete(null); showToast('Sensor removed.');
  }

  function openEdit(s: SensorDevice) {
    setEditSensor(s); setDeviceId(s.device_id); setZone(s.zone_id as ZoneId); setShowModal(true);
  }

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Sensors</h1>
        <button onClick={() => { setEditSensor(null); setDeviceId(''); setZone('A'); setShowModal(true); }}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors">
          + Add Sensor
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              {['Device ID', 'Zone', 'Status', 'Last Ping', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sensors.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No sensors registered.</td></tr>
            )}
            {sensors.map((s) => (
              <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-white font-mono text-xs">{s.device_id}</td>
                <td className="px-4 py-3">
                  <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full text-xs">Zone {s.zone_id}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${s.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${s.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
                    {s.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{timeAgo(s.last_ping)}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openEdit(s)}
                    className="text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-2 py-1 rounded transition-colors">
                    Edit Zone
                  </button>
                  <button onClick={() => setConfirmDelete(s.id)}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-2 py-1 rounded transition-colors">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-white font-bold mb-4">{editSensor ? 'Edit Sensor' : 'Add Sensor'}</h2>
            <div className="space-y-3">
              <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
                placeholder="Device ID (e.g. esp32-zone-a)" disabled={!!editSensor}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 disabled:opacity-50" />
              <select value={zone} onChange={(e) => setZone(e.target.value as ZoneId)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                {(['A', 'B', 'C', 'D'] as ZoneId[]).map((z) => (
                  <option key={z} value={z}>Zone {z}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-center">
            <p className="text-white font-semibold mb-2">Delete this sensor?</p>
            <p className="text-slate-400 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
