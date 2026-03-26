'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Flame } from 'lucide-react';

interface WorkspaceData {
  name: string;
  location: string | null;
  floor_plan_url: string | null;
}

type State = 'loading' | 'ready' | 'no_map' | 'not_found' | 'evacuating';

export default function EvacuationMapPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, setState]       = useState<State>('loading');
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [isPdf, setIsPdf]       = useState(false);

  useEffect(() => {
    if (!workspaceId) { setState('not_found'); return; }

    supabase
      .from('workspaces')
      .select('name, location, floor_plan_url')
      .eq('id', workspaceId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setState('not_found'); return; }
        setWorkspace(data);
        if (!data.floor_plan_url) { setState('no_map'); return; }
        setIsPdf(data.floor_plan_url.toLowerCase().includes('.pdf'));
        setState('ready');
      });
  }, [workspaceId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading evacuation plan...</p>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (state === 'not_found') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-white font-bold text-xl">Invalid QR Code</h1>
        <p className="text-slate-500 text-sm max-w-xs">
          This QR code is not linked to any registered building. Please contact your building admin.
        </p>
      </div>
    );
  }

  // ── No map uploaded ────────────────────────────────────────────────────────
  if (state === 'no_map') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="text-5xl">🗺️</div>
        <h1 className="text-white font-bold text-xl">No Evacuation Plan Available</h1>
        <p className="text-slate-500 text-sm max-w-xs">
          The admin for <span className="text-white font-medium">{workspace?.name}</span> has not uploaded a floor plan yet.
        </p>
        <p className="text-slate-600 text-xs mt-2">Please follow physical exit signs and staff instructions.</p>
      </div>
    );
  }

  // ── Evacuating ─────────────────────────────────────────────────────────────
  if (state === 'evacuating') {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Alert banner */}
        <div className="bg-red-600 px-4 py-3 flex items-center gap-3 animate-pulse">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-wider">Evacuation In Progress</p>
            <p className="text-red-200 text-xs">Follow the marked exits on the map below</p>
          </div>
        </div>

        {/* Map fullscreen */}
        <div className="flex-1 relative overflow-hidden">
          {isPdf
            ? <iframe src={workspace!.floor_plan_url!} className="w-full h-full border-0" title="Evacuation floor plan" />
            : <img src={workspace!.floor_plan_url!} alt="Evacuation floor plan"
                className="w-full h-full object-contain" />
          }
          {/* Overlay instructions */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-6">
            <p className="text-green-400 font-bold text-center text-sm mb-1">🟢 Find the nearest green exit</p>
            <p className="text-slate-400 text-center text-xs">Stay low · Do not use elevators · Help others</p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-[#0a0a0a] border-t border-white/5 px-4 py-4 flex gap-3">
          <button onClick={() => setState('ready')}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-medium">
            ← Back to Map
          </button>
          <a href="tel:112"
            className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold text-center">
            📞 Call 112
          </a>
        </div>
      </div>
    );
  }

  // ── Ready — main view ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 border-b border-white/5 flex items-center gap-3"
        style={{ background: 'rgba(10,10,10,0.95)' }}>
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
          <Flame className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">Emergency Evacuation System</p>
          <p className="text-slate-500 text-xs truncate">{workspace?.name}{workspace?.location ? ` · ${workspace.location}` : ''}</p>
        </div>
      </header>

      {/* Instruction banner */}
      <div className="px-4 py-3 text-center" style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
        <p className="text-red-400 text-xs font-semibold uppercase tracking-wider">
          Follow instructions to exit safely
        </p>
      </div>

      {/* Floor map */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-lg rounded-2xl overflow-hidden border border-white/8 shadow-2xl"
          style={{ background: 'rgba(15,15,15,0.8)' }}>
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-white text-sm font-semibold">Building Floor Plan</p>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Live
            </span>
          </div>
          {isPdf
            ? <iframe src={workspace!.floor_plan_url!} className="w-full h-64 sm:h-96 border-0" title="Floor plan" />
            : <img src={workspace!.floor_plan_url!} alt="Building floor plan"
                className="w-full max-h-64 sm:max-h-96 object-contain p-2" />
          }
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-4 pb-8 pt-2 space-y-3">
        <button
          onClick={() => setState('evacuating')}
          className="w-full py-4 rounded-2xl text-white font-black text-lg tracking-wide flex items-center justify-center gap-3 transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #dc2626, #ef4444)',
            boxShadow: '0 0 32px rgba(239,68,68,0.4), 0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          🚨 Start Evacuation
        </button>
        <p className="text-center text-slate-600 text-xs">
          Only press in case of emergency
        </p>
      </div>
    </div>
  );
}
