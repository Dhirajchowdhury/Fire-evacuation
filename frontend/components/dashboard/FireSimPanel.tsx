'use client';
/**
 * FireSimPanel — Admin debug panel to simulate ESP32 fire/safe signals.
 * Updates hazard_nodes table → triggers Supabase Realtime → map updates.
 */
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeHazards } from '../../hooks/useRealtimeHazards';
import type { GraphNode } from '../../lib/astar';

interface Props {
  workspaceId: string;
  nodes: GraphNode[];   // from building_graph
}

export default function FireSimPanel({ workspaceId, nodes }: Props) {
  const { hazards, fireNodeIds } = useRealtimeHazards(workspaceId);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [newStatus, setNewStatus]       = useState<'fire' | 'safe'>('fire');
  const [severity, setSeverity]         = useState(3);
  const [busy, setBusy]                 = useState(false);
  const [toast, setToast]               = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  async function triggerUpdate() {
    if (!selectedNode) { showToast('Select a node first'); return; }
    setBusy(true);
    const { error } = await supabase
      .from('hazard_nodes')
      .upsert(
        {
          workspace_id: workspaceId,
          node_id: selectedNode,
          status: newStatus,
          severity: newStatus === 'fire' ? severity : 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,node_id' }
      );
    setBusy(false);
    if (error) { showToast('Error: ' + error.message); return; }
    showToast(`${selectedNode} → ${newStatus.toUpperCase()}`);
  }

  async function clearAll() {
    setBusy(true);
    await supabase
      .from('hazard_nodes')
      .update({ status: 'safe', severity: 1, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId);
    setBusy(false);
    showToast('All nodes cleared to SAFE');
  }

  const roomNodes = nodes.filter(n => n.type !== 'exit');

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">🧪 Fire Simulation Panel</p>
          <p className="text-slate-500 text-xs mt-0.5">Simulates ESP32 sensor data via Supabase</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Realtime</span>
        </div>
      </div>

      {/* Active fires */}
      {fireNodeIds.size > 0 && (
        <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">
          <p className="text-red-400 text-xs font-semibold mb-2">🔥 Active fire nodes:</p>
          <div className="flex flex-wrap gap-2">
            {[...fireNodeIds].map(id => (
              <span key={id} className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full font-mono">
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3">
        {/* Node selector */}
        <div>
          <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1.5">Node</label>
          <select
            value={selectedNode}
            onChange={e => setSelectedNode(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          >
            <option value="">— Select node —</option>
            {roomNodes.map(n => (
              <option key={n.id} value={n.id}>
                {n.id} ({n.type}){fireNodeIds.has(n.id) ? ' 🔥' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Status toggle */}
        <div>
          <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1.5">Status</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            <button
              onClick={() => setNewStatus('fire')}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                newStatus === 'fire' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🔥 FIRE
            </button>
            <button
              onClick={() => setNewStatus('safe')}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                newStatus === 'safe' ? 'bg-green-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🟢 SAFE
            </button>
          </div>
        </div>

        {/* Severity (only for fire) */}
        {newStatus === 'fire' && (
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1.5">
              Severity: {severity}/5
            </label>
            <input
              type="range" min={1} max={5} value={severity}
              onChange={e => setSeverity(Number(e.target.value))}
              className="w-full accent-red-500"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-0.5">
              <span>Smoke</span><span>Moderate</span><span>Severe</span>
            </div>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={triggerUpdate}
          disabled={busy || !selectedNode}
          className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          style={{
            background: newStatus === 'fire'
              ? 'linear-gradient(135deg,#dc2626,#ef4444)'
              : 'linear-gradient(135deg,#15803d,#22c55e)',
            boxShadow: busy ? 'none' : newStatus === 'fire'
              ? '0 0 20px rgba(239,68,68,0.3)'
              : '0 0 20px rgba(34,197,94,0.2)',
          }}
        >
          {busy
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating...</>
            : `⚡ Trigger ${newStatus.toUpperCase()}`
          }
        </button>

        {/* Clear all */}
        {fireNodeIds.size > 0 && (
          <button
            onClick={clearAll}
            disabled={busy}
            className="w-full py-2 rounded-xl border border-slate-600 text-slate-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            ✓ Clear All Fires
          </button>
        )}
      </div>

      {/* Node status table */}
      {hazards.size > 0 && (
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Current Hazard State</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...hazards.values()].map(h => (
              <div key={h.node_id} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-800">
                <span className="text-slate-300 font-mono">{h.node_id}</span>
                <div className="flex items-center gap-2">
                  {h.status === 'fire' && (
                    <span className="text-orange-400">sev {h.severity}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${
                    h.status === 'fire' ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'
                  }`}>
                    {h.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-4 bg-slate-800 border border-slate-600 text-white text-xs px-3 py-2 rounded-lg z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
