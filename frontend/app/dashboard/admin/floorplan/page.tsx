'use client';
import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { ZoneStatus } from '../../../../../shared/types';
import type { GraphNode, GraphEdge } from '../../../../lib/astar';

const BuildingCanvas = dynamic(
  () => import('../../../../../visualization/three-engine/BuildingCanvas'),
  { ssr: false, loading: () => <div className="w-full h-full bg-slate-900 animate-pulse rounded-xl" /> }
);

const MapEditor = dynamic(() => import('./MapEditor'), { ssr: false });
const Generate3DButton = dynamic(() => import('../../../../components/dashboard/Generate3DButton'), { ssr: false });
const FireSimPanel = dynamic(() => import('../../../../components/dashboard/FireSimPanel'), { ssr: false });

const TABS = ['Upload Floor Plan', 'Map Editor', 'Fire Simulation', '3D Building View'] as const;
type Tab = typeof TABS[number];

export default function FloorPlanPage() {
  const { workspace, workspaceId } = useAdminWorkspace();
  const [tab, setTab]         = useState<Tab>('Upload Floor Plan');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(workspace?.floor_plan_url ?? null);
  const [isPdf, setIsPdf]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const zones: ZoneStatus[]   = [];

  // Graph state — loaded from workspace.building_graph
  const [nodes, setNodes] = useState<GraphNode[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = workspace?.building_graph as any;
    return g?.nodes ?? [];
  });
  const [edges, setEdges] = useState<GraphEdge[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = workspace?.building_graph as any;
    return g?.edges ?? [];
  });

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const handleFile = useCallback(async (file: File) => {
    if (!workspaceId) { showToast('No workspace found.', false); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10MB.', false); return; }
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) { showToast('Invalid file type. Use PDF, PNG, or JPG.', false); return; }

    setUploading(true);
    setProgress(10);

    const path = `${workspaceId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;

    const { error: upErr } = await supabase.storage
      .from('floor_plans')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      showToast(`Upload failed: ${upErr.message}`, false);
      setUploading(false);
      setProgress(0);
      return;
    }

    setProgress(80);
    const { data: { publicUrl } } = supabase.storage.from('floor_plans').getPublicUrl(path);
    await supabase.from('workspaces').update({ floor_plan_url: publicUrl }).eq('id', workspaceId);
    setPreviewUrl(publicUrl);
    setIsPdf(file.type === 'application/pdf');
    setUploading(false);
    setProgress(100);
    showToast('Floor plan uploaded successfully!');
    setTimeout(() => setProgress(0), 1000);
  }, [workspaceId]);

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-white">Floor Plan</h1>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 sm:px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'text-white border-b-2 border-red-500' : 'text-slate-400 hover:text-white'
            }`}>{t}</button>
        ))}
      </div>

      {tab === 'Upload Floor Plan' ? (
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            aria-label="Upload floor plan — click or drag and drop"
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all select-none ${
              uploading
                ? 'border-slate-600 bg-slate-800/20 cursor-not-allowed'
                : dragging
                  ? 'border-red-500 bg-red-950/20 cursor-copy scale-[1.01]'
                  : 'border-slate-600 hover:border-slate-400 bg-slate-800/40 cursor-pointer'
            }`}
          >
            <p className="text-4xl mb-3">{dragging ? '📂' : '📁'}</p>
            <p className="text-white font-semibold text-sm sm:text-base">
              {dragging ? 'Drop to upload' : 'Drop your floor plan here'}
            </p>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">or click to browse</p>
            <p className="text-slate-600 text-xs mt-2">PDF, PNG, JPG · Max 10MB</p>

            {/* Progress bar */}
            {uploading && (
              <div className="mt-4 mx-auto max-w-xs">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }} />
                </div>
                <p className="text-red-400 text-xs mt-2 animate-pulse">Uploading...</p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={onInputChange}
              disabled={uploading}
            />
          </div>

          {/* Fallback button for mobile */}
          <button
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            className="w-full sm:hidden py-3 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            📎 Choose File
          </button>

          {/* Preview */}
          {previewUrl && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-400 text-xs uppercase tracking-wider">Current Floor Plan</p>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Replace →
                </button>
              </div>
              {isPdf
                ? <iframe src={previewUrl} className="w-full h-64 sm:h-96 rounded-lg border border-slate-700" title="Floor plan PDF" />
                : <img src={previewUrl} alt="Floor plan" className="w-full max-h-64 sm:max-h-96 object-contain rounded-lg" />
              }

              {/* Generate 3D Model */}
              {workspaceId && !isPdf && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">AI 3D Generation</p>
                  <Generate3DButton workspaceId={workspaceId} imageUrl={previewUrl} />
                </div>
              )}
            </div>
          )}
        </div>
      ) : tab === 'Fire Simulation' ? (
        <div>
          {workspaceId && nodes.length > 0 ? (
            <FireSimPanel workspaceId={workspaceId} nodes={nodes} />
          ) : (
            <div className="rounded-xl border border-slate-700 p-8 text-center">
              <p className="text-slate-400 text-sm">
                {!workspaceId ? 'No workspace found.' : 'Add nodes in the Map Editor first, then simulate fire here.'}
              </p>
            </div>
          )}
        </div>
      ) : tab === 'Map Editor' ? (
        <div>
          {previewUrl ? (
            <MapEditor
              workspaceId={workspaceId!}
              imageUrl={previewUrl}
              initialNodes={nodes}
              initialEdges={edges}
              onSaved={(n, e) => { setNodes(n); setEdges(e); }}
            />
          ) : (
            <div className="rounded-xl border border-slate-700 p-8 text-center">
              <p className="text-slate-400 text-sm">Upload a floor plan first, then use the Map Editor.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="h-64 sm:h-[500px] rounded-xl overflow-hidden border border-slate-700">
            <BuildingCanvas zones={zones} evacuationPath={null} />
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
            {[['🔴', 'Fire Zone'], ['🟢', 'Safe Zone'], ['📡', 'Sensor'], ['🚪', 'Exit']].map(([icon, label]) => (
              <span key={label} className="flex items-center gap-1.5 text-slate-400 text-xs sm:text-sm">
                <span>{icon}</span>{label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-auto max-w-sm text-white text-sm px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-2 ${
          toast.ok ? 'bg-green-900 border border-green-700' : 'bg-red-950 border border-red-800'
        }`}>
          <span>{toast.ok ? '✓' : '⚠'}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
