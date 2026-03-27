'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Flame } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { astar } from '../../../lib/astar';
import type { GraphNode, GraphEdge } from '../../../lib/astar';

const EvacuationCanvas = dynamic(
  () => import('../../../components/map/EvacuationCanvas'),
  { ssr: false }
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
  const [screen, setScreen]       = useState<Screen>('loading');
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [nodes, setNodes]         = useState<GraphNode[]>([]);
  const [edges, setEdges]         = useState<GraphEdge[]>([]);
  const [path, setPath]           = useState<string[]>([]);
  const [startNode, setStartNode] = useState<string | null>(null);
  const [noPath, setNoPath]       = useState(false);
  const [fireZones, setFireZones] = useState<Set<string>>(new Set());

  const recalcPath = useCallback((ns: GraphNode[], es: GraphEdge[], start: string | null) => {
    if (!start) { setPath([]); return; }
    const result = astar(ns, es, start);
    if (result) { setPath(result); setNoPath(false); }
    else { setPath([]); setNoPath(true); }
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
        if (!ws.floor_plan_url) { setScreen('no_map'); return; }
        if (ws.building_graph?.nodes?.length) {
          setNodes(ws.building_graph.nodes);
          setEdges(ws.building_graph.edges ?? []);
          const first = ws.building_graph.nodes.find(n => n.type !== 'exit');
          if (first) setStartNode(first.id);
        }
        setScreen('ready');
      });
  }, [workspaceId]);

  // Realtime fire updates
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase.channel(`fire-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, (payload) => {
        const row = payload.new as { zone_id: string; status: string };
        if (!row) return;
        setNodes(prev => {
          const updated = prev.map(n =>
            n.id.toLowerCase().includes(row.zone_id.toLowerCase())
              ? { ...n, status: (row.status === 'fire' ? 'fire' : 'safe') as GraphNode['status'] }
              : n
          );
          recalcPath(updated, edges, startNode);
          return updated;
        });
        setFireZones(prev => {
          const s = new Set(prev);
          row.status === 'fire' ? s.add(row.zone_id) : s.delete(row.zone_id);
          return s;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId, edges, startNode, recalcPath]);

  useEffect(() => { recalcPath(nodes, edges, startNode); }, [startNode, nodes, edges, recalcPath]);

  function handleNodeClick(id: string) {
    if (screen !== 'evacuating') return;
    const n = nodes.find(n => n.id === id);
    if (!n || n.type === 'exit' || n.status === 'fire') return;
    setStartNode(id);
  }

  if (screen === 'loading') return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Loading evacuation plan...</p>
    </div>
  );

  if (screen === 'not_found') return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-white font-bold text-xl">Invalid QR Code</h1>
      <p className="text-slate-500 text-sm max-w-xs">This QR code is not linked to any registered building.</p>
    </div>
  );

  if (screen === 'no_map') return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="text-5xl">🗺️</div>
      <h1 className="text-white font-bold text-xl">No Evacuation Plan Available</h1>
      <p className="text-slate-500 text-sm max-w-xs">
        <span className="text-white font-medium">{workspace?.name}</span> has not uploaded a floor plan yet.
      </p>
    </div>
  );

  const hasGraph = nodes.length > 0;
  const isPdf    = workspace?.floor_plan_url?.toLowerCase().includes('.pdf') ?? false;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-white/5 flex items-center gap-3 shrink-0"
        style={{ background: 'rgba(8,8,8,0.97)' }}>
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
          <Flame className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold text-sm truncate">Emergency Evacuation System</p>
          <p className="text-slate-500 text-xs truncate">
            {workspace?.name}{workspace?.location ? ` · ${workspace.location}` : ''}
          </p>
        </div>
        {screen === 'evacuating' && (
          <span className="shrink-0 text-xs text-red-400 font-bold animate-pulse">🚨 LIVE</span>
        )}
      </header>

      {/* Fire alert */}
      {fireZones.size > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 shrink-0"
          style={{ background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.25)' }}>
          <span className="text-red-400 animate-pulse">🔥</span>
          <p className="text-red-300 text-xs font-semibold">
            Fire in zone{fireZones.size > 1 ? 's' : ''}: {[...fireZones].join(', ')} — Route recalculated
          </p>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative overflow-hidden">
        {hasGraph && workspace?.floor_plan_url ? (
          <EvacuationCanvas
            imageUrl={workspace.floor_plan_url}
            nodes={nodes}
            edges={edges}
            path={screen === 'evacuating' ? path : []}
            selectedNode={startNode}
            onNodeClick={handleNodeClick}
          />
        ) : workspace?.floor_plan_url ? (
          isPdf
            ? <iframe src={workspace.floor_plan_url} className="w-full h-full border-0" title="Floor plan" />
            : <img src={workspace.floor_plan_url} alt="Floor plan" className="w-full h-full object-contain" />
        ) : null}

        {screen === 'evacuating' && (
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none px-4 pb-4 pt-12"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
            {noPath
              ? <p className="text-red-400 font-bold text-center text-sm">⚠ No safe path — follow physical exit signs</p>
              : path.length > 0
                ? <p className="text-green-400 font-bold text-center text-sm">🟢 Follow the green path to exit</p>
                : null}
            {hasGraph && <p className="text-slate-500 text-center text-xs mt-1">Tap your location to recalculate</p>}
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="shrink-0 px-4 py-4 space-y-2"
        style={{ background: 'rgba(6,6,6,0.97)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {screen === 'ready' ? (
          <>
            <button onClick={() => setScreen('evacuating')}
              className="w-full py-4 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)', boxShadow: '0 0 32px rgba(239,68,68,0.4)' }}>
              🚨 Start Evacuation
            </button>
            <p className="text-center text-slate-600 text-xs">Only press in case of emergency</p>
          </>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => { setScreen('ready'); setPath([]); }}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-medium">
              ← Back
            </button>
            <a href="tel:112"
              className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold text-center flex items-center justify-center">
              📞 Call 112
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
