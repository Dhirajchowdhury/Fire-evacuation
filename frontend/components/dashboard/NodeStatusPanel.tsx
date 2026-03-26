'use client';
import type { ZoneStatus, ZoneId } from '../../../shared/types';
import buildingGraph from '../../../shared/building-graph.json';

interface Props {
  zones: ZoneStatus[];
}

// Derive zone → node labels from building-graph.json (never hardcoded)
function getZoneNodeLabels(zoneId: string): string {
  return buildingGraph.nodes
    .filter((n) => n.zone === zoneId)
    .map((n) => n.label)
    .join(', ');
}

const ZONE_IDS: ZoneId[] = ['A', 'B', 'C', 'D'];

export default function NodeStatusPanel({ zones }: Props) {
  const isLoading = zones.length === 0;

  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Zone Status</h2>

      {isLoading
        ? ZONE_IDS.map((id) => (
            <div key={id} className="h-20 rounded-lg bg-slate-800 animate-pulse" />
          ))
        : ZONE_IDS.map((zoneId) => {
            const zone = zones.find((z) => z.zone_id === zoneId);
            const isFire = zone?.status === 'fire';
            const nodeLabels = getZoneNodeLabels(zoneId);

            return (
              <div
                key={zoneId}
                className={`rounded-lg border p-3 transition-all duration-300 ${
                  isFire
                    ? 'border-red-500 bg-red-950/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                    : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white">Zone {zoneId}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full transition-all duration-300 ${
                      isFire
                        ? 'bg-red-500 text-white'
                        : 'bg-green-500/20 text-green-400 border border-green-500/40'
                    }`}
                  >
                    {isFire ? '🔥 FIRE' : 'SAFE'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{nodeLabels || '—'}</p>
              </div>
            );
          })}
    </div>
  );
}
