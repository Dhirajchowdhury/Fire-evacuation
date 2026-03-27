'use client';
/**
 * ESP32SimPanel — Simulates real ESP32 sensor data via Supabase.
 * Updates esp32_nodes table with smoke_value + flame_status.
 * DB trigger auto-computes status = "fire" | "safe".
 * Frontend subscribes via useESP32Nodes and reacts in real-time.
 */
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useESP32Nodes, computeStatus } from '../../hooks/useESP32Nodes';

interface Props {
  workspaceId: string;
}

const SMOKE_PRESETS = [
  { label: 'Normal (0)',      smoke: 0,    flame: 0 as const },
  { label: 'Low smoke (800)', smoke: 800,  flame: 0 as const },
  { label: 'High smoke (2000)', smoke: 2000, flame: 0 as const },
  { label: 'Flame only',      smoke: 0,    flame: 1 as const },
  { label: 'Full fire',       smoke: 2500, flame: 1 as const },
];

export default function ESP32SimPanel({ workspaceId }: Props) {
  const { nodes, fireNodes, isLoading } = useESP32Nodes(workspaceId);

  const [nodeName, setNodeName]   = useState('');
  const [smokeVal, setSmokeVal]   = useState(0);
  const [flameStatus, setFlameStatus] = useState<0 | 1>(0);
  const [busy, setBusy]           = useState(false);
  const [addBusy, setAddBusy]     = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // Apply a preset
  function applyPreset(smoke: number, flame: 0 | 1) {
    setSmokeVal(smoke);
    setFlameStatus(flame);
  }

  // Simulate sensor update
  async function handleSimulate() {
    if (!nodeName) { showToast('Select a node first', false); return; }
    setBusy(true);

    const status = computeStatus(smokeVal, flameStatus);
    const { error } = await supabase
      .from('esp32_nodes')
      .upsert(
        {
          workspace_id: workspaceId,
          node_name: nodeName,
          smoke_value: smokeVal,
          flame_status: flameStatus,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,node_name' }
      );

    setBusy(false);
    if (error) { showToast('Update failed: ' + error.message, false); return; }
    showToast(`${nodeName} → ${status.toUpperCase()} (smoke: ${smokeVal}, flame: ${flameStatus})`);
  }

  // Add a new node
  async function handleAddNode() {
    if (!newNodeName.trim()) return;
    setAddBusy(true);
    const { error } = await supabase
      .from('esp32_nodes')
      .insert({
        workspace_id: workspaceId,
        node_name: newNodeName.trim(),
        smoke_value: 0,
        flame_status: 0,
        status: 'safe',
      });
    setAddBusy(false);
    if (error) { showToast('Failed: ' + error.message, false); return; }
    setNewNodeName('');
    showToast(`Node "${newNodeName.trim()}" added`);
  }

  // Clear all fires
  async function clearAll() {
    setBusy(true);
    await supabase
      .from('esp32_nodes')
      .update({ smoke_value: 0, flame_status: 0, status: 'safe', updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId);
    setBusy(false);
    showToast('All nodes cleared to SAFE');
  }

  const predictedStatus = computeStatus(smokeVal, flameStatus);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">ESP32 Node Simulator</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Simulates real sensor data — smoke_value + flame_status → auto status
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Realtime</span>
        </div>
      </div>

      {/* Fire alert */}
      {fireNodes.length > 0 && (
        <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">
          <p className="text-red-400 text-xs font-bold mb-2 flex items-center gap-1.5">
            <span className="animate-pulse">🔥</span> {fireNodes.length} node{fireNodes.length > 1 ? 's' : ''} on fire
          </p>
          <div className="flex flex-wrap gap-2">
            {fireNodes.map(n => (
              <span key={n.id} className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full font-mono">
                {n.node_name} (smoke: {n.smoke_value}, flame: {n.flame_status})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add node */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Add ESP32 Node</p>
        <div className="flex gap-2">
          <input
            value={newNodeName}
            onChange={e => setNewNodeName(e.target.value)}
            placeholder="e.g. Node 1, Room A, Corridor B"
            onKeyDown={e => e.key === 'Enter' && handleAddNode()}
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
          />
          <button
            onClick={handleAddNode}
            disabled={addBusy || !newNodeName.trim()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
          >
            {addBusy ? '...' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Simulate panel */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
        <p className="text-slate-400 text-xs uppercase tracking-wider">Simulate Sensor Reading</p>

        {/* Node selector */}
        <div>
          <label className="text-slate-500 text-xs block mb-1">Select Node</label>
          <select
            value={nodeName}
            onChange={e => setNodeName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          >
            <option value="">— Select node —</option>
            {nodes.map(n => (
              <option key={n.id} value={n.node_name}>
                {n.node_name} {n.status === 'fire' ? '🔥' : '🟢'}
              </option>
            ))}
          </select>
        </div>

        {/* Presets */}
        <div>
          <label className="text-slate-500 text-xs block mb-1.5">Quick Presets</label>
          <div className="flex flex-wrap gap-2">
            {SMOKE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.smoke, p.flame)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  smokeVal === p.smoke && flameStatus === p.flame
                    ? 'border-red-500 bg-red-950/30 text-red-300'
                    : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Smoke value */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-slate-500 text-xs">Smoke Value</label>
            <span className={`text-xs font-bold ${smokeVal > 1500 ? 'text-red-400' : 'text-green-400'}`}>
              {smokeVal} {smokeVal > 1500 ? '⚠ HIGH' : '✓ NORMAL'}
            </span>
          </div>
          <input
            type="range" min={0} max={3000} step={50} value={smokeVal}
            onChange={e => setSmokeVal(Number(e.target.value))}
            className="w-full accent-red-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-0.5">
            <span>0</span><span className="text-yellow-600">1500 threshold</span><span>3000</span>
          </div>
          <input
            type="number" min={0} max={9999} value={smokeVal}
            onChange={e => setSmokeVal(Math.min(9999, Math.max(0, Number(e.target.value))))}
            className="mt-2 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
            placeholder="Or type exact value"
          />
        </div>

        {/* Flame status */}
        <div>
          <label className="text-slate-500 text-xs block mb-1.5">Flame Status</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            <button
              onClick={() => setFlameStatus(0)}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                flameStatus === 0 ? 'bg-green-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              0 — No Flame
            </button>
            <button
              onClick={() => setFlameStatus(1)}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                flameStatus === 1 ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              1 — Flame Detected 🔥
            </button>
          </div>
        </div>

        {/* Predicted status */}
        <div className={`rounded-lg px-4 py-2.5 border text-sm font-semibold flex items-center gap-2 ${
          predictedStatus === 'fire'
            ? 'bg-red-950/40 border-red-800 text-red-300'
            : 'bg-green-950/30 border-green-800 text-green-400'
        }`}>
          <span>{predictedStatus === 'fire' ? '🔥' : '🟢'}</span>
          Predicted status: <span className="uppercase">{predictedStatus}</span>
          <span className="text-xs opacity-60 ml-auto">
            {smokeVal > 1500 ? 'smoke > 1500' : flameStatus === 1 ? 'flame = 1' : 'all clear'}
          </span>
        </div>

        {/* Simulate button */}
        <button
          onClick={handleSimulate}
          disabled={busy || !nodeName}
          className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          style={{
            background: predictedStatus === 'fire'
              ? 'linear-gradient(135deg,#dc2626,#ef4444)'
              : 'linear-gradient(135deg,#15803d,#22c55e)',
            boxShadow: busy ? 'none' : predictedStatus === 'fire'
              ? '0 0 20px rgba(239,68,68,0.3)'
              : '0 0 20px rgba(34,197,94,0.2)',
          }}
        >
          {busy
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
            : `⚡ Send to Supabase`
          }
        </button>

        {fireNodes.length > 0 && (
          <button
            onClick={clearAll}
            disabled={busy}
            className="w-full py-2 rounded-xl border border-slate-600 text-slate-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            ✓ Clear All Fires
          </button>
        )}
      </div>

      {/* Live node table */}
      {!isLoading && nodes.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <p className="text-white text-sm font-semibold">Live Node Status</p>
            <span className="text-slate-500 text-xs">{nodes.length} nodes</span>
          </div>
          <div className="divide-y divide-slate-700/50">
            {nodes.map(n => (
              <div key={n.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  n.status === 'fire' ? 'bg-red-500 animate-pulse' : 'bg-green-400'
                }`} />
                <span className="text-white text-sm font-medium flex-1">{n.node_name}</span>
                <span className="text-slate-500 text-xs">smoke: {n.smoke_value}</span>
                <span className="text-slate-500 text-xs">flame: {n.flame_status}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  n.status === 'fire' ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'
                }`}>
                  {n.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="h-20 bg-slate-800 animate-pulse rounded-xl" />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-auto text-white text-xs px-4 py-2.5 rounded-xl shadow-xl z-50 ${
          toast.ok ? 'bg-green-900 border border-green-700' : 'bg-red-950 border border-red-800'
        }`}>
          {toast.ok ? '✓' : '⚠'} {toast.msg}
        </div>
      )}
    </div>
  );
}
