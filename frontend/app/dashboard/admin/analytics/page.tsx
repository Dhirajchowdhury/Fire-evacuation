'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { ZoneAlert, Drill } from '../../../../../shared/types';

const ZONE_COLORS: Record<string, string> = { A: '#ef4444', B: '#f97316', C: '#eab308', D: '#22c55e' };

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <p className="text-slate-400 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { workspaceId } = useAdminWorkspace();
  const [alerts, setAlerts] = useState<ZoneAlert[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('drills').select('*').eq('workspace_id', workspaceId).order('started_at'),
    ]).then(([alertsRes, drillsRes]) => {
      setAlerts((alertsRes.data ?? []) as ZoneAlert[]);
      setDrills((drillsRes.data ?? []) as Drill[]);
      setLoading(false);
    });
  }, [workspaceId]);

  // Last 7 days bar chart data
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const count = alerts.filter((a) => {
      const ad = new Date(a.created_at);
      return ad.toDateString() === d.toDateString();
    }).length;
    return { day: label, alerts: count };
  });

  // Zone risk pie data
  const zonePie = ['A', 'B', 'C', 'D'].map((z) => ({
    name: `Zone ${z}`,
    value: alerts.filter((a) => a.zone_id === z).length || 0,
  })).filter((z) => z.value > 0);

  // Drill participation line data
  const drillLine = drills.filter((d) => d.status === 'completed').map((d) => ({
    date: new Date(d.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    pct: d.acknowledged_count,
  }));

  // Stats
  const thisMonth = alerts.filter((a) => {
    const d = new Date(a.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const mostAtRisk = (['A', 'B', 'C', 'D'] as const).reduce((best, z) => {
    const count = alerts.filter((a) => a.zone_id === z).length;
    return count > (alerts.filter((a) => a.zone_id === best).length) ? z : best;
  }, 'A' as string);

  const avgDrillResponse = drills.length > 0
    ? Math.round(drills.reduce((sum, d) => sum + d.acknowledged_count, 0) / drills.length)
    : 0;

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Incidents This Month" value={thisMonth} />
        <StatCard label="Avg Drill Response"   value={`${avgDrillResponse} ack`} />
        <StatCard label="Most At-Risk Zone"    value={`Zone ${mostAtRisk}`} />
        <StatCard label="Total Drills"         value={drills.length} />
      </div>

      {/* Alert frequency bar chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <p className="text-white font-semibold mb-4">Alert Frequency — Last 7 Days</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={last7}>
            <XAxis dataKey="day" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
            <Bar dataKey="alerts" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Zone risk pie */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <p className="text-white font-semibold mb-4">Zone Risk Analysis</p>
          {zonePie.length === 0
            ? <p className="text-slate-500 text-sm text-center py-8">No alert data yet.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={zonePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {zonePie.map((entry) => (
                      <Cell key={entry.name} fill={ZONE_COLORS[entry.name.replace('Zone ', '')] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Drill participation line */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <p className="text-white font-semibold mb-4">Drill Participation</p>
          {drillLine.length === 0
            ? <p className="text-slate-500 text-sm text-center py-8">No completed drills yet.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <LineChart data={drillLine}>
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="pct" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                </LineChart>
              </ResponsiveContainer>
          }
        </div>
      </div>
    </div>
  );
}
