'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Flame } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { astarAllPaths } from '../../../lib/astar';
import type { GraphNode, GraphEdge, PathResult } from '../../../lib/astar';
import { useFireState } from '../../../hooks/useFireState';

const EvacuationCanvas = dynamic(
  () => import('../../../components/map/EvacuationCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

interface WorkspaceData {
  name: string;
  location: string | null;
  floor_plan_url: string | null;
  building_graph: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
}

type Screen = 'loading' | 'ready' | 'evacuating' | 'no_map' | 'not_found';

export default function EvacuationMapPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const [screen, setScreen]         = useState<Screen>('loading');
  const [workspace, setWorkspace]   = useState<WorkspaceData | null>(null);
  const [baseNodes, setBaseNodes]   = useState<GraphNode[]>([]);
  const [edges, setEdges]           = useState<GraphEdge[]>([]);
  const [allPaths, setAllPaths]     = useState<PathResult[]>([]);
  const [activePath, setActivePath] = useState(0); // index into allPaths
  const [startNode, setStartNode]   = useState<string | null>(null);
  const [noPath, setNoPath]         = useState(false);
  const [wsId, setWsId]             = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const { fireNodeIds, isEmergency } = useFireState(wsId);
  const recalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodes = useMemo<GraphNode[]>(
    () => baseNodes.map(n => ({
      ...n,
      status: fireNodeIds.has(n.id) ? 'fire' : 'safe',
    })),
    [baseNodes, fireNodeIds]
  );

  const recalcPath = useCallback((ns: GraphNode[], es: GraphEdge[], start: string | null) => {
    if (recalcTimer.current) clearTimeout(recalcTimer.current);
    recalcTimer.current = setTimeout(() => {
      if (!start) { setAllPaths([]); return; }
      const results = astarAllPaths(ns, es, start);
      if (results.length > 0) {
        setAllPaths(results);
        setActivePath(0); // default to shortest
        setNoPath(false);
      } else {
        setAllPaths([]);
        setNoPath(true);
      }
    }, 80);
  }, []);

  useEffect(() => {
    if (!workspaceId) { setScreen('not_found'); return; }
    supabase
      .from('workspaces')
      .select('name, location, floor_plan_url, building_graph')
      .eq('id', workspaceId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setScreen('not_found'); return; }
        const ws = data as WorkspaceData;
        setWorkspace(ws);
        setWsId(workspaceId);
        if (!ws.floor_plan_url) { setScreen('no_map'); return; }
        if (ws.building_graph?.nodes?.length) {
          setBaseNodes(ws.building_graph.nodes);
          setEdges(ws.building_graph.edges ?? []);
          const first = ws.building_graph.nodes.find(n => n.type !== 'exit');
          if (first) setStartNode(first.id);
        }
        setScreen('ready');
      });
  }, [workspaceId]);

  // Auto-trigger evacuation when fire detected
  useEffect(() => {
    if (isEmergency && screen === 'ready') setScreen('evacuating');
  }, [isEmergency, screen]);

  // Recalc all paths on fire/start/edge change
  useEffect(() => {
    recalcPath(nodes, edges, startNode);
    return () => { if (recalcTimer.current) clearTimeout(recalcTimer.current); };
  }, [nodes, edges, startNode, recalcPath]);

  // Fade-in overlay
  useEffect(() => {
    if (screen === 'evacuating') {
      setOverlayVisible(false);
      const t = setTimeout(() => setOverlayVisible(true), 300);
      return () => clearTimeout(t);
    }
    setOverlayVisible(false);
  }, [screen]);

  function handleNodeClick(id: string) {
    if (screen !== 'evacuating') return;
    const n = nodes.find(n => n.id === id);
    if (!n || n.type === 'exit' || n.status === 'fire') return;
    setStartNode(id);
    setActivePath(0);
  }

  // ── Static screens ─────────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Loading evacuation plan...</p>
    </div>
  );

  if (screen === 'not_found') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-white font-bold text-xl">Invalid QR Code</h1>
      <p className="text-slate-500 text-sm max-w-xs">This QR code is not linked to any registered building.</p>
    </div>
  );

  if (screen === 'no_map') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="text-5xl">🗺️</div>
      <h1 className="text-white font-bold text-xl">No Evacuation Plan Available</h1>
      <p className="text-slate-500 text-sm max-w-xs">
        <span className="text-white font-medium">{workspace?.name}</span> has not uploaded a floor plan yet.
      </p>
    </div>
  );

  const hasGraph  = nodes.length > 0;
  const isPdf     = workspace?.floor_plan_url?.toLowerCase().includes('.pdf') ?? false;
  const isEvac    = screen === 'evacuating';
  const bestPath  = allPaths[activePath]?.path ?? [];

  return (
    <>
      {/* Fullscreen canvas in evacuation mode */}
      {isEvac && hasGraph && workspace?.floor_plan_url && (
        <div className="fixed inset-0 z-0 bg-black">
          <EvacuationCanvas
            imageUrl={workspace.floor_plan_url}
            nodes={nodes}
            edges={edges}
            allPaths={allPaths}
            activePath={activePath}
            selectedNode={startNode}
            onNodeClick={handleNodeClick}
          />
        </div>
      )}

      <div className={isEvac ? 'fixed inset-0 z-10 pointer-events-none' : 'min-h-screen bg-black flex flex-col'}>

        {/* Header */}
        <header
          className="pointer-events-auto px-4 py-3 flex items-center gap-3 shrink-0"
          style={{
            background: isEvac ? 'rgba(0,0,0,0.78)' : 'rgba(8,8,8,0.97)',
            backdropFilter: isEvac ? 'blur(10px)' : 'none',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold leading-tight truncate" style={{ fontSize: 'clamp(13px,2vw,15px)' }}>
              Emergency Evacuation System
            </p>
            <p className="text-slate-500 truncate" style={{ fontSize: 'clamp(11px,1.5vw,12px)' }}>
              {workspace?.name}{workspace?.location ? ` · ${workspace.location}` : ''}
            </p>
          </div>
          {isEvac && <span className="shrink-0 text-xs text-red-400 font-bold animate-pulse">🚨 LIVE</span>}
        </header>

        {/* Fire alert */}
        {fireNodeIds.size > 0 && (
          <div
            className="pointer-events-auto px-4 py-2 flex items-center gap-2 shrink-0"
            style={{ background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.3)' }}
          >
            <span className="text-red-400 animate-pulse">🔥</span>
            <p className="text-red-300 font-semibold" style={{ fontSize: 'clamp(11px,1.5vw,13px)' }}>
              Fire: {[...fireNodeIds].join(', ')} — {allPaths.length} route{allPaths.length !== 1 ? 's' : ''} available
            </p>
          </div>
        )}

        {/* Map — ready mode */}
        {!isEvac && (
          <div className="flex-1 relative overflow-hidden">
            {hasGraph && workspace?.floor_plan_url ? (
              <EvacuationCanvas
                imageUrl={workspace.floor_plan_url}
                nodes={nodes}
                edges={edges}
                allPaths={[]}
                activePath={0}
                selectedNode={startNode}
                onNodeClick={handleNodeClick}
              />
            ) : workspace?.floor_plan_url ? (
              isPdf
                ? <iframe src={workspace.floor_plan_url} className="w-full h-full border-0" title="Floor plan" />
                : <img src={workspace.floor_plan_url} alt="Floor plan" className="w-full h-full object-contain" />
            ) : null}
          </div>
        )}

        {/* Evacuation overlay */}
        {isEvac && (
          <div
            className="pointer-events-none absolute left-0 right-0 flex flex-col items-center px-4 gap-2"
            style={{ bottom: '130px', opacity: overlayVisible ? 1 : 0, transition: 'opacity 0.6s ease' }}
          >
            {noPath ? (
              <div className="bg-red-950/85 border border-red-700 rounded-2xl px-5 py-3 text-center backdrop-blur-sm">
                <p className="text-red-300 font-bold" style={{ fontSize: 'clamp(13px,2vw,15px)' }}>
                  ⚠ No safe path — follow physical exit signs
                </p>
              </div>
            ) : bestPath.length > 0 ? (
              <>
                <div className="bg-black/75 border border-green-500/30 rounded-2xl px-5 py-3 text-center backdrop-blur-sm">
                  <p className="text-green-400 font-bold" style={{ fontSize: 'clamp(13px,2vw,15px)' }}>
                    🟢 Follow the green path to exit
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">Tap your location on the map to recalculate</p>
                </div>

                {/* Path selector — switch between routes */}
                {allPaths.length > 1 && (
                  <div className="pointer-events-auto flex gap-2 flex-wrap justify-center">
                    {allPaths.map((p, i) => (
                      <button
                        key={p.exitId}
                        onClick={() => setActivePath(i)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          i === activePath
                            ? 'bg-green-600 border-green-500 text-white'
                            : 'bg-black/60 border-white/20 text-slate-300 hover:border-green-500'
                        }`}
                      >
                        Route {i + 1} {i === 0 ? '(shortest)' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Bottom buttons */}
        <div
          className="pointer-events-auto shrink-0 space-y-2"
          style={{
            position: isEvac ? 'fixed' : 'relative',
            bottom: isEvac ? 0 : undefined,
            left: isEvac ? 0 : undefined,
            right: isEvac ? 0 : undefined,
            padding: isEvac ? '12px 5% 20px' : '16px',
            background: isEvac ? 'rgba(0,0,0,0.85)' : 'rgba(6,6,6,0.97)',
            backdropFilter: isEvac ? 'blur(14px)' : 'none',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {screen === 'ready' ? (
            <>
              <button
                onClick={() => setScreen('evacuating')}
                className="w-full rounded-2xl text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{
                  padding: 'clamp(14px,3vw,18px) 0',
                  fontSize: 'clamp(16px,3vw,20px)',
                  background: 'linear-gradient(135deg,#dc2626,#ef4444)',
                  boxShadow: '0 0 32px rgba(239,68,68,0.45)',
                }}
              >
                🚨 Start Evacuation
              </button>
              <p className="text-center text-slate-600" style={{ fontSize: 'clamp(11px,1.5vw,12px)' }}>
                Only press in case of emergency
              </p>
            </>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => { setScreen('ready'); setAllPaths([]); }}
                className="flex-1 rounded-xl border border-white/10 text-slate-400 font-medium active:scale-95 transition-transform"
                style={{ padding: 'clamp(12px,2.5vw,16px) 0', fontSize: 'clamp(13px,2vw,15px)' }}
              >
                ← Back
              </button>
              <a
                href="tel:112"
                className="flex-1 rounded-xl bg-red-600 text-white font-bold text-center flex items-center justify-center active:scale-95 transition-transform"
                style={{ padding: 'clamp(12px,2.5vw,16px) 0', fontSize: 'clamp(13px,2vw,15px)' }}
              >
                📞 Call 112
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
