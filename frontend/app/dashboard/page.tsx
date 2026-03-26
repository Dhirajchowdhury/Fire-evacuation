'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EvacuationRoute } from '../../../shared/types';
import { useRealtimeZones } from '../../hooks/useRealtimeZones';
import Header from '../../components/dashboard/Header';
import NodeStatusPanel from '../../components/dashboard/NodeStatusPanel';
import FireAlertFeed from '../../components/dashboard/FireAlertFeed';
import EvacuationRouteInfo from '../../components/dashboard/EvacuationRouteInfo';
import ZoneTriggerPanel from '../../components/dashboard/ZoneTriggerPanel';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

// BuildingCanvas uses Three.js — must be client-only, no SSR
const BuildingCanvas = dynamic(
  () => import('../../../visualization/three-engine/BuildingCanvas'),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#0f172a]" /> }
);

export default function DashboardPage() {
  const { zones, alerts, isLoading } = useRealtimeZones();
  const [evacuationRoute, setEvacuationRoute] = useState<EvacuationRoute | null>(null);

  // Re-compute evacuation route whenever zone statuses change
  useEffect(() => {
    const firedZones = zones.filter((z) => z.status === 'fire').map((z) => z.zone_id);

    if (firedZones.length === 0) {
      setEvacuationRoute(null);
      return;
    }

    fetch(`${BACKEND_URL}/api/evacuation-route`)
      .then((r) => r.json())
      .then((data) => setEvacuationRoute(data.route ?? null))
      .catch(() => setEvacuationRoute(null));
  }, [zones]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f172a]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Connecting to FireRoute...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] overflow-hidden">
      <Header zones={zones} />

      {/* Main content */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">

        {/* 3D Canvas — takes remaining space */}
        <div className="flex-1 min-h-[40vh] md:min-h-0">
          <BuildingCanvas zones={zones} evacuationPath={evacuationRoute?.path ?? null} />
        </div>

        {/* Right panel */}
        <div className="w-full md:w-72 flex flex-col border-t md:border-t-0 md:border-l border-slate-800 min-h-0">
          <div className="flex-shrink-0">
            <NodeStatusPanel zones={zones} />
          </div>
          <div className="flex-1 min-h-0 border-t border-slate-800 overflow-hidden">
            <FireAlertFeed alerts={alerts} />
          </div>
        </div>
      </div>

      {/* Bottom bar — evacuation route info */}
      <div className="shrink-0 px-4 py-2 border-t border-slate-800 bg-slate-900/60">
        <EvacuationRouteInfo route={evacuationRoute} zones={zones} />
      </div>

      {/* Dev controls */}
      <ZoneTriggerPanel />
    </div>
  );
}
