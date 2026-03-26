'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useAdminWorkspace } from '../../../hooks/useAdminWorkspace';
import type { ZoneStatus, ZoneAlert, SensorDevice, Announcement, Drill } from '../../../../shared/types';

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <p className="text-slate-400 text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-black mt-1 ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-slate-800 animate-pulse rounded-xl ${className}`} />;
}

export default function AdminOverview() {
  const { workspaceId, workspace, isLoading: wsLoading } = useAdminWorkspace();
  const [zones, setZones]               = useState<ZoneStatus[]>([]);
  const [alerts, setAlerts]             = useState<ZoneAlert[]>([]);
  const [sensors, setSensors]           = useState<SensorDevice[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [lastDrill, setLastDrill]       = useState<Drill | null>(null);
  const [userCount, setUserCount]       = useState(0);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!workspaceId) return;

    async function load() {
      const [zonesRes, alertsRes, sensorsRes, usersRes, annRes, drillRes] = await Promise.all([
        supabase.from('zones').select('*').order('zone_id'),
        supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('sensor_devices').select('*').eq('workspace_id', workspaceId),
        supabase.from('profiles').select('id').eq('workspace_id', workspaceId),
        supabase.from('announcements').select('*').eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('drills').select('*').eq('workspace_id', workspaceId)
          .order('started_at', { ascending: false }).limit(1).single(),
      ]);
      setZones((zonesRes.data ?? []) as ZoneStatus[]);
      setAlerts((alertsRes.data ?? []) as ZoneAlert[]);
      setSensors((sensorsRes.data ?? []) as SensorDevice[]);
      setUserCount(usersRes.data?.length ?? 0);
      if (!annRes.error) setAnnouncement(annRes.data as Announcement);
      if (!drillRes.error) setLastDrill(drillRes.data as Drill);
      setLoading(false);
    }
    load();

    const ch = supabase.channel('overview-zones')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'zones' }, (p) => {
        setZones((prev) => prev.map((z) => z.zone_id === (p.new as ZoneStatus).zone_id ? p.new as ZoneStatus : z));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (p) => {
        setAlerts((prev) => [p.new as ZoneAlert, ...prev].slice(0, 5));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);

  const fireCount     = zones.filter((z) => z.status === 'fire').length;
  const onlineSensors = sensors.filter((s) => s.status === 'online').length;

  if (wsLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          {workspace && <p className="text-slate-500 text-sm mt-0.5">{workspace.name}</p>}
        </div>
        {fireCount > 0 && (
          <div className="flex items-center gap-2 bg-red-950/60 border border-red-800 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-300 text-sm font-semibold">{fireCount} zone{fireCount > 1 ? 's' : ''} on fire</span>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users"    value={userCount} />
        <StatCard label="Active Sensors" value={`${onlineSensors}/${sensors.length}`}
          accent={onlineSensors < sensors.length ? 'text-yellow-400' : 'text-green-400'} />
        <StatCard label="Active Alerts"  value={fireCount}
          sub={fireCount > 0 ? 'zones on fire' : 'all clear'}
          accent={fireCount > 0 ? 'text-red-400' : 'text-green-400'} />
        <StatCard label="Last Drill"
          value={lastDrill ? new Date(lastDrill.started_at).toLocaleDateString() : '—'} />
      </div>

      {/* Zone status grid */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold">Zone Status</p>
          <Link href="/dashboard/admin/floorplan"
            className="text-xs text-slate-400 hover:text-white transition-colors">
            View 3D Map →
          </Link>
        </div>
        {zones.length === 0 ? (
          <p className="text-slate-500 text-sm">No zones configured yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {zones.map((z) => (
              <div key={z.zone_id}
                className={`rounded-xl px-4 py-3 text-center border transition-all ${
                  z.status === 'fire'
                    ? 'bg-red-950/50 border-red-700 text-red-300'
                    : 'bg-green-950/20 border-green-900 text-green-400'
                }`}>
                <p className="font-bold text-lg">{z.status === 'fire' ? '🔥' : '🟢'}</p>
                <p className="font-semibold text-sm mt-1">Zone {z.zone_id}</p>
                <p className="text-xs opacity-70 capitalize">{z.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Recent alerts */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-semibold">Recent Alerts</p>
            <Link href="/dashboard/admin/alerts"
              className="text-xs text-slate-400 hover:text-white transition-colors">View all →</Link>
          </div>
          <div className="space-y-2">
            {alerts.length === 0
              ? <p className="text-slate-500 text-sm">No alerts yet.</p>
              : alerts.map((a) => (
                <div key={a.id} className={`text-xs px-3 py-2 rounded-lg border-l-2 ${
                  a.status === 'fire'
                    ? 'border-red-500 bg-red-950/30 text-red-300'
                    : 'border-green-500 bg-green-950/20 text-green-400'
                }`}>
                  <span className="font-semibold">Zone {a.zone_id}</span>
                  <span className="text-slate-500 mx-1">·</span>
                  {a.message}
                </div>
              ))
            }
          </div>
        </div>

        {/* Sensors */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-semibold">Sensors</p>
            <Link href="/dashboard/admin/sensors"
              className="text-xs text-slate-400 hover:text-white transition-colors">Manage →</Link>
          </div>
          {sensors.length === 0 ? (
            <p className="text-slate-500 text-sm">No sensors registered yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm mb-3">
                <span className="text-green-400 font-bold">{onlineSensors} online</span>
                <span className="text-red-400 font-bold">{sensors.length - onlineSensors} offline</span>
              </div>
              {sensors.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-mono">{s.device_id}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    s.status === 'online' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                  }`}>{s.status}</span>
                </div>
              ))}
              {sensors.length > 4 && (
                <p className="text-slate-500 text-xs">+{sensors.length - 4} more</p>
              )}
            </div>
          )}
        </div>

        {/* Latest announcement */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-semibold">Latest Announcement</p>
            <Link href="/dashboard/admin/announcements"
              className="text-xs text-slate-400 hover:text-white transition-colors">Manage →</Link>
          </div>
          {announcement
            ? <>
                <p className="text-white font-medium text-sm">{announcement.title}</p>
                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{announcement.message}</p>
                <p className="text-slate-600 text-xs mt-2">{new Date(announcement.created_at).toLocaleDateString()}</p>
              </>
            : <p className="text-slate-500 text-sm">No announcements yet.</p>
          }
        </div>

        {/* Last drill */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-semibold">Last Drill</p>
            <Link href="/dashboard/admin/drills"
              className="text-xs text-slate-400 hover:text-white transition-colors">Run drill →</Link>
          </div>
          {lastDrill
            ? <>
                <p className="text-white text-sm font-medium">{new Date(lastDrill.started_at).toLocaleString()}</p>
                <p className="text-slate-400 text-xs mt-1">
                  Status:{' '}
                  <span className={lastDrill.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}>
                    {lastDrill.status}
                  </span>
                  {' · '}{lastDrill.acknowledged_count} acknowledged
                </p>
              </>
            : <p className="text-slate-500 text-sm">No drills conducted yet.</p>
          }
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '🔗 Share QR Code',    href: '/dashboard/admin/qrcode' },
          { label: '📢 Announcement',     href: '/dashboard/admin/announcements' },
          { label: '🧪 Run Drill',        href: '/dashboard/admin/drills' },
          { label: '🆘 Emergency',        href: '/dashboard/admin/emergency' },
        ].map(({ label, href }) => (
          <Link key={href} href={href}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl px-4 py-3 text-sm text-slate-300 hover:text-white transition-all text-center">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
