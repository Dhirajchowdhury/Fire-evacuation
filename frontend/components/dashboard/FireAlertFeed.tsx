'use client';
import { useMemo } from 'react';
import type { ZoneAlert } from '../../../shared/types';

interface Props {
  alerts: ZoneAlert[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const ZONE_BADGE_COLORS: Record<string, string> = {
  A: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  B: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  C: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  D: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
};

export default function FireAlertFeed({ alerts }: Props) {
  const hasRecentAlert = useMemo(() => {
    if (alerts.length === 0) return false;
    const latest = new Date(alerts[0].created_at).getTime();
    return Date.now() - latest < 10_000;
  }, [alerts]);

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Alert Feed
        </h2>
        {hasRecentAlert && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500 text-center mt-6">
            No alerts recorded. System monitoring active. 🟢
          </p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-md bg-slate-800/60 px-3 py-2 border-l-4 ${
                alert.status === 'fire' ? 'border-[#ef4444]' : 'border-[#22c55e]'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-slate-500 font-mono">
                  {formatTime(alert.created_at)}
                </span>
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${
                    ZONE_BADGE_COLORS[alert.zone_id] ?? 'bg-slate-700 text-slate-300'
                  }`}
                >
                  Zone {alert.zone_id}
                </span>
              </div>
              <p className="text-sm text-slate-200">{alert.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
