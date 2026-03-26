'use client';
import type { EvacuationRoute, ZoneStatus } from '../../../shared/types';
import buildingGraph from '../../../shared/building-graph.json';

interface Props {
  route: EvacuationRoute | null;
  zones: ZoneStatus[];
}

function getNodeLabel(id: string): string {
  return buildingGraph.nodes.find((n) => n.id === id)?.label ?? id;
}

export default function EvacuationRouteInfo({ route, zones }: Props) {
  const hasFire = zones.some((z) => z.status === 'fire');

  // Case 3: fire active but no safe path
  if (hasFire && !route) {
    return (
      <div className="w-full px-4 py-3 bg-red-950 border border-red-800 rounded-lg flex items-center gap-3">
        <span className="text-lg">🚨</span>
        <p className="text-red-300 font-semibold text-sm">
          BUILDING LOCKDOWN — No safe evacuation path available. Call emergency services immediately.
        </p>
      </div>
    );
  }

  // Case 1: all safe
  if (!route) {
    return (
      <div className="w-full px-4 py-3 bg-green-950/60 border border-green-700 rounded-lg flex items-center gap-3">
        <span className="text-lg">✅</span>
        <p className="text-green-300 font-semibold text-sm">
          All zones clear — Building is safe
        </p>
      </div>
    );
  }

  // Case 2: active evacuation route
  return (
    <div className="w-full px-4 py-3 bg-gradient-to-r from-red-950/80 to-orange-950/80 border border-red-700 rounded-lg">
      <p className="text-red-400 font-bold text-sm mb-1">
        🔥 Fire in Zone {route.blocked_zones.join(', ')}
      </p>
      <p className="text-slate-300 text-xs mb-2 font-semibold uppercase tracking-wider">
        Evacuation Route:
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {route.path.map((nodeId, i) => {
          const isExit = buildingGraph.nodes.find((n) => n.id === nodeId)?.type === 'exit';
          return (
            <span key={nodeId} className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  isExit
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/60'
                    : 'bg-slate-700 text-slate-200 border-slate-600'
                }`}
              >
                {getNodeLabel(nodeId)}
              </span>
              {i < route.path.length - 1 && (
                <span className="text-slate-500 text-xs">→</span>
              )}
            </span>
          );
        })}
      </div>
      <p className="text-slate-400 text-xs">{route.description}</p>
    </div>
  );
}
