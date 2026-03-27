'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  workspaceId: string;
  imageUrl: string;
}

type Status = 'idle' | 'generating' | 'done' | 'error';

export default function Generate3DButton({ workspaceId, imageUrl }: Props) {
  const [status, setStatus]   = useState<Status>('idle');
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleGenerate() {
    setStatus('generating');
    setError(null);
    setModelUrl(null);

    try {
      const res = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error ?? `Server error ${res.status}`);
      }

      // Fal triposr returns model_mesh.url
      const url = json.data?.model_mesh?.url ?? json.data?.mesh?.url ?? null;
      if (!url) throw new Error('No 3D model URL in response');

      setModelUrl(url);

      // Optionally store in workspace metadata
      await supabase
        .from('workspaces')
        .update({ building_graph: { ...(json.data ?? {}), model_3d_url: url } })
        .eq('id', workspaceId)
        .then(() => {}); // fire and forget

      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleGenerate}
        disabled={status === 'generating'}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
        style={{
          background: status === 'done'
            ? 'linear-gradient(135deg,#16a34a,#22c55e)'
            : 'linear-gradient(135deg,#7c3aed,#a855f7)',
          boxShadow: status === 'generating' ? 'none' : '0 0 20px rgba(168,85,247,0.3)',
        }}
      >
        {status === 'generating' ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
            Generating 3D...
          </>
        ) : status === 'done' ? (
          '✓ 3D Model Ready'
        ) : (
          '✨ Generate 3D Model'
        )}
      </button>

      {error && (
        <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          ⚠ {error}
        </p>
      )}

      {modelUrl && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-green-400 text-sm font-semibold">3D model generated!</p>
          <a
            href={modelUrl}
            download="floor-plan-3d.glb"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors w-fit"
          >
            ⬇ Download .glb Model
          </a>
          <p className="text-slate-500 text-xs">
            Open with Blender, Windows 3D Viewer, or any GLTF viewer.
          </p>
        </div>
      )}
    </div>
  );
}
