'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { Drill } from '../../../../../shared/types';

function formatDuration(start: string, end: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function DrillsPage() {
  const { workspaceId, profile } = useAdminWorkspace();
  const [drills, setDrills]       = useState<Drill[]>([]);
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [confirm, setConfirm]     = useState(false);
  const [starting, setStarting]   = useState(false);
  const [elapsed, setElapsed]     = useState('0m 0s');
  const [toast, setToast]         = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      supabase.from('drills').select('*').eq('workspace_id', workspaceId).order('started_at', { ascending: false }),
      supabase.from('profiles').select('id').eq('workspace_id', workspaceId),
    ]).then(([drillsRes, usersRes]) => {
      const all = (drillsRes.data ?? []) as Drill[];
      setDrills(all);
      setActiveDrill(all.find((d) => d.status === 'active') ?? null);
      setUserCount(usersRes.data?.length ?? 0);
      setLoading(false);
    });
  }, [workspaceId]);

  useEffect(() => {
    if (!activeDrill) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setElapsed(formatDuration(activeDrill.started_at, null)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeDrill]);

  async function startDrill() {
    if (!workspaceId || !profile) return;
    setStarting(true);
    const { data, error } = await supabase.from('drills')
      .insert({ workspace_id: workspaceId, triggered_by: profile.id, status: 'active' })
      .select().single();
    if (error) { showToast('Failed to start drill.'); setStarting(false); return; }
    const drill = data as Drill;
    setActiveDrill(drill);
    setDrills((prev) => [drill, ...prev]);
    await supabase.from('announcements').insert({
      workspace_id: workspaceId, admin_id: profile.id,
      title: '🧪 EVACUATION DRILL IN PROGRESS',
      message: 'This is a drill. Please follow evacuation procedures.',
      type: 'drill',
    });
    setConfirm(false); setStarting(false);
    showToast('Drill started and users notified.');
  }

  async function endDrill() {
    if (!activeDrill || !workspaceId || !profile) return;
    await supabase.from('drills').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', activeDrill.id);
    await supabase.from('announcements').insert({
      workspace_id: workspaceId, admin_id: profile.id,
      title: '✅ Drill Complete',
      message: 'Thank you for participating.',
      type: 'drill',
    });
    setDrills((prev) => prev.map((d) => d.id === activeDrill.id ? { ...d, status: 'completed', ended_at: new Date().toISOString() } : d));
    setActiveDrill(null);
    showToast('Drill ended. Users notified.');
  }

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Drill Mode</h1>

      {/* Start drill */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
        {activeDrill ? (
          <div className="space-y-4">
            <div className="text-5xl">🧪</div>
            <p className="text-yellow-400 font-bold text-xl">Drill In Progress</p>
            <p className="text-slate-400 text-sm">Duration: <span className="text-white font-mono">{elapsed}</span></p>
            <p className="text-slate-400 text-sm">
              Acknowledged: <span className="text-white font-bold">{activeDrill.acknowledged_count}</span> / {userCount}
            </p>
            <button onClick={endDrill}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors">
              ✅ End Drill
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-5xl">🧪</div>
            <p className="text-white font-bold text-xl">Start Evacuation Drill</p>
            <p className="text-slate-400 text-sm">Sends a drill notification to all workspace users.</p>
            <button onClick={() => setConfirm(true)}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors">
              🧪 Start Evacuation Drill
            </button>
          </div>
        )}
      </div>

      {/* Drill history */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Drill History</h2>
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                {['Date', 'Duration', 'Acknowledged', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drills.filter((d) => d.status === 'completed').length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No completed drills yet.</td></tr>
              )}
              {drills.filter((d) => d.status === 'completed').map((d) => (
                <tr key={d.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-slate-300">{new Date(d.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono">{formatDuration(d.started_at, d.ended_at)}</td>
                  <td className="px-4 py-3 text-slate-300">{d.acknowledged_count}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-green-950 text-green-400 px-2 py-0.5 rounded-full">Completed</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-center">
            <p className="text-white font-semibold mb-2">Start Evacuation Drill?</p>
            <p className="text-slate-400 text-sm mb-5">This will alert all users with a DRILL notification. Continue?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)}
                className="flex-1 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={startDrill} disabled={starting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
                {starting ? 'Starting...' : 'Start Drill'}
              </button>
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
