'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { IncidentRecord } from '../../../../../shared/types';
import buildingGraph from '../../../../../shared/building-graph.json';

function getNodeLabel(id: string): string {
  return buildingGraph.nodes.find((n) => n.id === id)?.label ?? id;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Ongoing';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const m = Math.floor(ms / 60000);
  return `${m}m`;
}

export default function RecordsPage() {
  const { workspaceId } = useAdminWorkspace();
  const [records, setRecords]   = useState<IncidentRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from('incident_records').select('*').eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .then(({ data }) => { setRecords((data ?? []) as IncidentRecord[]); setLoading(false); });
  }, [workspaceId]);

  const filtered = records.filter((r) => {
    if (zoneFilter !== 'all' && r.zone_id !== zoneFilter) return false;
    if (dateFrom && new Date(r.started_at) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(r.started_at) > new Date(dateTo))   return false;
    return true;
  });

  function exportCSV() {
    const rows = [['Date', 'Zone', 'Duration', 'Path', 'Resolved By'],
      ...filtered.map((r) => [r.started_at, r.zone_id, formatDuration(r.started_at, r.ended_at),
        (r.evacuation_path ?? []).join(' → '), r.resolved_by ?? ''])];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'records.csv'; a.click();
  }

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Past Records</h1>
        <button onClick={exportCSV}
          className="px-4 py-2 border border-slate-600 text-slate-300 hover:text-white text-sm rounded-lg transition-colors">
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none">
          <option value="all">All Zones</option>
          {['A', 'B', 'C', 'D'].map((z) => <option key={z} value={z}>Zone {z}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none" />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              {['Date', 'Zone', 'Duration', 'Path Used', 'Alerts'].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No records found.</td></tr>
            )}
            {filtered.map((r) => (
              <>
                <tr key={r.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="px-4 py-3 text-slate-300">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full text-xs">Zone {r.zone_id}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono">{formatDuration(r.started_at, r.ended_at)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-xs">
                    {(r.evacuation_path ?? []).map(getNodeLabel).join(' → ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.total_alerts}</td>
                </tr>
                {expanded === r.id && (
                  <tr key={`${r.id}-exp`} className="bg-slate-900/60">
                    <td colSpan={5} className="px-6 py-4">
                      <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Full Evacuation Path</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(r.evacuation_path ?? []).map((nodeId, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-xs">{getNodeLabel(nodeId)}</span>
                            {i < (r.evacuation_path ?? []).length - 1 && <span className="text-slate-600 text-xs">→</span>}
                          </span>
                        ))}
                      </div>
                      {r.notes && <p className="text-slate-400 text-xs mt-3">Notes: {r.notes}</p>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
