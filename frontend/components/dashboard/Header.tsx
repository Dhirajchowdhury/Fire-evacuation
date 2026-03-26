'use client';
import { Flame } from 'lucide-react';
import type { ZoneStatus } from '../../../shared/types';

interface Props {
  zones: ZoneStatus[];
}

export default function Header({ zones }: Props) {
  const hasFire = zones.some((z) => z.status === 'fire');

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <Flame className="text-orange-500 w-5 h-5" />
        <div>
          <h1 className="text-base font-bold text-white leading-none">FireRoute</h1>
          <p className="text-xs text-slate-400 mt-0.5">Real-time Evacuation Intelligence</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              hasFire ? 'bg-red-400' : 'bg-green-400'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              hasFire ? 'bg-red-500' : 'bg-green-500'
            }`}
          />
        </span>
        <span className={`text-xs font-medium ${hasFire ? 'text-red-400' : 'text-green-400'}`}>
          {hasFire ? 'Fire Detected' : 'System Active'}
        </span>
      </div>
    </header>
  );
}
