'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { ZoneAlert, ZoneStatus } from '../../../../../shared/types';

type Filter = 'all' | 'fire' | 'safe';

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function AlertsPage() {
  const [alerts, setAlerts]   = useState<ZoneAlert[]>([]);
  const [zones, setZones]     = useState<ZoneStatus[]>([]);
  const [filter, setFilter]   = useState<Filter>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('zones').select('*').order('zone_id'),
    ]).then(([alertsRes, zonesRes]) => {
      setAlerts((alertsRes.data ?? []) as ZoneAlert[]);
      setZones((zonesRes.data ?? []) as ZoneStatus[]);
      setLoading(false);
    });

    const ch = supabase.channel('alerts-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (p) => {
        setAlerts((prev) => [p.new as ZoneAlert, ...prev]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'zones' }, (p) => {
        setZones((prev) => prev.map((z) => z.zone_id === (p.new as ZoneStatus).zone_id ? p.new as ZoneStatus : z));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = alerts.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (zoneFilter !== 'all' && a.zone_id !== zoneFilter) return false;
    return true;
  });

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Live Alerts</h1>

      {/* Zone status badges */}
      <div className="flex gap-3 flex-wrap">
        {zones.map((z) => (
          <div key={z.zone_id} className={`px-4 py-2 rounded-xl border text-sm font-semibold ${
            z.status === 'fire'
              ? 'bg-red-950/60 border-red-700 text-red-300'
              : 'bg-green-950/30 border-green-800 text-green-400'
          }`}>
            Zone {z.zone_id} {z.status === 'fire' ? '🔥' : '🟢'}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        {(['all', 'fire', 'safe'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}>{f}</button>
        ))}
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
          <option value="all">All Zones</option>
          {['A', 'B', 'C', 'D'].map((z) => <option key={z} value={z}>Zone {z}</option>)}
        </select>
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">No alerts match the current filter.</p>
        )}
        {filtered.map((a) => (
          <div key={a.id} className={`flex items-start gap-4 bg-slate-800 border-l-4 rounded-xl px-4 py-3 ${
            a.status === 'fire' ? 'border-red-500' : 'border-green-500'
          }`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  a.status === 'fire' ? 'bg-red-950 text-red-300' : 'bg-green-950 text-green-400'
                }`}>Zone {a.zone_id}</span>
                <span className="text-slate-500 text-xs font-mono">{timeStr(a.created_at)}</span>
              </div>
              <p className="text-slate-200 text-sm">{a.message}</p>
            </div>
            <button className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-1 rounded transition-colors shrink-0">
              Acknowledge
            </button>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
