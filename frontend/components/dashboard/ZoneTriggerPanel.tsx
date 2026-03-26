// ⚠️ DEV ONLY — Remove before production
'use client';
import { useState } from 'react';
import type { ZoneId } from '../../../shared/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const ZONES: ZoneId[] = ['A', 'B', 'C', 'D'];

export default function ZoneTriggerPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  async function trigger(zone: ZoneId, status: 'fire' | 'safe') {
    const key = `${zone}-${status}`;
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/fire-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone, status, device_id: 'dev-trigger' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      showToast(`Zone ${zone} → ${status.toUpperCase()}`, true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', false);
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="border-t border-slate-800 bg-slate-900/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 text-left text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-2"
      >
        <span>🛠 Dev Controls</span>
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-yellow-500/70 mb-3">
            ⚠️ Developer testing panel — not for production use
          </p>
          {ZONES.map((zone) => (
            <div key={zone} className="flex items-center gap-3">
              <span className="text-sm text-slate-400 w-14">Zone {zone}</span>
              <button
                disabled={!!loading[`${zone}-fire`]}
                onClick={() => trigger(zone, 'fire')}
                className="px-3 py-1 text-xs rounded bg-red-600/80 hover:bg-red-600 text-white disabled:opacity-40 transition-colors"
              >
                {loading[`${zone}-fire`] ? '...' : '🔥 Trigger Fire'}
              </button>
              <button
                disabled={!!loading[`${zone}-safe`]}
                onClick={() => trigger(zone, 'safe')}
                className="px-3 py-1 text-xs rounded bg-green-700/80 hover:bg-green-700 text-white disabled:opacity-40 transition-colors"
              >
                {loading[`${zone}-safe`] ? '...' : '✅ Clear'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50 transition-all ${
            toast.ok ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
