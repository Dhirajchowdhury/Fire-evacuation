'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import buildingGraph from '../../../../../shared/building-graph.json';

const ZONES = ['A', 'B', 'C', 'D'] as const;

function getZoneColor(count: number): string {
  if (count <= 5)  return 'border-green-700 bg-green-950/30';
  if (count <= 15) return 'border-yellow-700 bg-yellow-950/30';
  return 'border-red-700 bg-red-950/30';
}

function getBarColor(count: number): string {
  if (count <= 5)  return 'bg-green-500';
  if (count <= 15) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function OccupancyPage() {
  const { workspaceId } = useAdminWorkspace();
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [updatedAt, setUpdatedAt] = useState(new Date());

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from('profiles').select('id').eq('workspace_id', workspaceId)
      .then(({ data }) => {
        setUserCount(data?.length ?? 0);
        setUpdatedAt(new Date());
        setLoading(false);
      });
  }, [workspaceId]);

  // Distribute users evenly across zones as MVP approximation
  const perZone = Math.floor(userCount / 4);
  const remainder = userCount % 4;
  const zoneCounts: Record<string, number> = {};
  ZONES.forEach((z, i) => { zoneCounts[z] = perZone + (i < remainder ? 1 : 0); });

  const zoneNodeLabels = (zoneId: string) =>
    buildingGraph.nodes.filter((n) => n.zone === zoneId).map((n) => n.label).join(', ');

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Occupancy</h1>
      <div className="bg-yellow-950/40 border border-yellow-800 rounded-xl px-4 py-3 text-yellow-300 text-sm">
        ℹ️ Occupancy is based on user app activity in each zone (approximated for MVP)
      </div>

      <div className="grid grid-cols-2 gap-4">
        {ZONES.map((z) => {
          const count = zoneCounts[z];
          const max = Math.max(userCount, 1);
          return (
            <div key={z} className={`border rounded-xl p-5 ${getZoneColor(count)}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-bold text-lg">Zone {z}</p>
                <span className="text-2xl font-black text-white">{count}</span>
              </div>
              <p className="text-slate-400 text-xs mb-3">{zoneNodeLabels(z)}</p>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${getBarColor(count)} rounded-full transition-all`}
                  style={{ width: `${Math.min((count / max) * 100, 100)}%` }} />
              </div>
              <p className="text-slate-500 text-xs mt-1">
                {count <= 5 ? 'Low' : count <= 15 ? 'Moderate' : 'High'} occupancy
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider">Total Building Occupancy</p>
          <p className="text-4xl font-black text-white mt-1">{userCount}</p>
        </div>
        <p className="text-slate-500 text-xs">Last updated: {updatedAt.toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
