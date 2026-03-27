'use client';
/**
 * MapEditor — Interactive 2D map editor.
 * - Click to place nodes
 * - Drag to reposition
 * - Shift+click OR Edge tool to connect
 * - Delete tool to remove
 * - Saves to workspaces.building_graph
 */
import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../../lib/supabase';
import type { GraphNode, GraphEdge } from '../../../../lib/astar';

const EvacuationCanvas = dynamic(
  () => import('../../../../components/map/EvacuationCanvas'),
  { ssr: false, loading: () => <div className="w-full h-full bg-slate-900 animate-pulse rounded-xl" /> }
);

type PlaceTool = 'node_room' | 'node_corridor' | 'node_exit' | 'node_hub';
type ActionTool = 'edge' | 'delete' | 'select';
type Tool = PlaceTool | ActionTool;

interface Props {
  workspaceId: string;
  imageUrl: string;
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  onSaved: (nodes: GraphNode[], edges: GraphEdge[]) => void;
}

const PLACE_TOOLS: { id: PlaceTool; label: string; color: string; key: string }[] = [
  { id: 'node_room',     label: '🏠 Room',     color: '#60a5fa', key: 'R' },
  { id: 'node_corridor', label: '🚶 Corridor', color: '#a78bfa', key: 'C' },
  { id: 'node_hub',      label: '⬡ Hub',       color: '#fbbf24', key: 'H' },
  { id: 'node_exit',     label: '🚪 Exit',     color: '#22c55e', key: 'E' },
];

const ACTION_TOOLS: { id: ActionTool; label: string; color: string; key: string }[] = [
  { id: 'select', label: '↖ Select', color: '#94a3b8', key: 'S' },
  { id: 'edge',   label: '🔗 Edge',  color: '#f97316', key: 'G' },
  { id: 'delete', label: '🗑 Delete',color: '#ef4444', key: 'X' },
];

export default function MapEditor({ workspaceId, imageUrl, initialNodes, initialEdges, onSaved }: Props) {
  const [nodes, setNodes]         = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges]         = useState<GraphEdge[]>(initialEdges);
  const [tool, setTool]           = useState<Tool>('node_room');
  const [selected, setSelected]   = useState<string | null>(null);
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [hint, setHint]           = useState('');
  const [toast, setToast]         = useState<{ msg: string; ok?: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  function setToolAndReset(t: Tool) {
    setTool(t);
    setEdgeStart(null);
    setSelected(null);
    const hints: Record<Tool, string> = {
      node_room:     'Click on the map to place a Room node',
      node_corridor: 'Click on the map to place a Corridor node',
      node_hub:      'Click on the map to place a Hub node',
      node_exit:     'Click on the map to place an Exit node',
      select:        'Click a node to select it',
      edge:          'Click first node, then second node to connect',
      delete:        'Click a node to delete it and its edges',
    };
    setHint(hints[t]);
  }

  // ── Canvas click — place node ──────────────────────────────────────────────
  const handleCanvasClick = useCallback((x: number, y: number) => {
    if (!tool.startsWith('node_')) return;
    const type = tool.replace('node_', '') as GraphNode['type'];
    const id = `${type}_${Date.now()}`;
    setNodes(prev => [...prev, { id, x, y, type, status: 'safe' }]);
    showToast(`${type} placed`);
  }, [tool]);

  // ── Node click — select / edge / delete ────────────────────────────────────
  const handleNodeClick = useCallback((id: string) => {
    if (tool === 'delete') {
      setNodes(prev => prev.filter(n => n.id !== id));
      setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
      if (selected === id) setSelected(null);
      showToast('Node deleted');
      return;
    }

    if (tool === 'edge') {
      if (!edgeStart) {
        setEdgeStart(id);
        setSelected(id);
        setHint('Now click the second node to connect');
      } else if (edgeStart !== id) {
        const exists = edges.some(e =>
          (e.from === edgeStart && e.to === id) || (e.from === id && e.to === edgeStart)
        );
        if (!exists) {
          setEdges(prev => [...prev, { from: edgeStart, to: id, blocked: false }]);
          showToast('Edge created');
        } else {
          showToast('Edge already exists', false);
        }
        setEdgeStart(null);
        setSelected(null);
        setHint('Click first node to start another edge');
      }
      return;
    }

    // Select tool
    setSelected(id === selected ? null : id);
  }, [tool, edgeStart, edges, selected]);

  // ── Node drag — update position ────────────────────────────────────────────
  const handleNodeDrag = useCallback((id: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  }, []);

  // ── Delete selected edge ───────────────────────────────────────────────────
  function deleteEdge(from: string, to: string) {
    setEdges(prev => prev.filter(e => !(e.from === from && e.to === to) && !(e.from === to && e.to === from)));
    showToast('Edge removed');
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('workspaces')
      .update({ building_graph: { nodes, edges } })
      .eq('id', workspaceId);
    setSaving(false);
    if (error) { showToast('Save failed: ' + error.message, false); return; }
    showToast('Map saved ✓');
    onSaved(nodes, edges);
  }

  function handleClear() {
    if (!confirm('Clear all nodes and edges?')) return;
    setNodes([]); setEdges([]); setSelected(null); setEdgeStart(null);
  }

  // ── Selected node info ─────────────────────────────────────────────────────
  const selectedNodeData = selected ? nodes.find(n => n.id === selected) : null;
  const selectedEdges    = selected
    ? edges.filter(e => e.from === selected || e.to === selected)
    : [];

  const exitCount = nodes.filter(n => n.type === 'exit').length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Place tools */}
        <div className="flex gap-1.5 flex-wrap">
          {PLACE_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setToolAndReset(t.id)}
              title={`${t.label} [${t.key}]`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={tool === t.id
                ? { background: t.color + '22', borderColor: t.color, color: t.color }
                : { borderColor: '#334155', color: '#64748b' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Action tools */}
        <div className="flex gap-1.5 flex-wrap">
          {ACTION_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setToolAndReset(t.id)}
              title={`${t.label} [${t.key}]`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={tool === t.id
                ? { background: t.color + '22', borderColor: t.color, color: t.color }
                : { borderColor: '#334155', color: '#64748b' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <button
          onClick={handleClear}
          className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-400 border border-slate-700 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 transition-colors"
          style={{ background: '#ef4444' }}
        >
          {saving ? 'Saving...' : '💾 Save Map'}
        </button>
      </div>

      {/* Hint bar */}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2">
        <span className="text-slate-600">💡</span>
        <span>{hint || 'Select a tool above to start editing'}</span>
        {edgeStart && (
          <span className="ml-auto text-orange-400 font-medium animate-pulse">
            Edge started — click target node
          </span>
        )}
      </div>

      {/* Canvas */}
      <div
        className="relative rounded-xl overflow-hidden border border-slate-700"
        style={{ height: 'clamp(320px, 50vh, 560px)', background: '#0f172a' }}
      >
        <EvacuationCanvas
          imageUrl={imageUrl}
          nodes={nodes}
          edges={edges}
          allPaths={[]}
          activePath={0}
          selectedNode={edgeStart ?? selected}
          onNodeClick={handleNodeClick}
          onNodeDrag={handleNodeDrag}
          editMode={true}
          onCanvasClick={handleCanvasClick}
        />

        {/* Overlay: no image */}
        {!imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-600 text-sm">Upload a floor plan first</p>
          </div>
        )}
      </div>

      {/* Stats + selected info */}
      <div className="flex gap-4 flex-wrap items-start">
        {/* Stats */}
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="text-slate-400">{nodes.length} nodes</span>
          <span className="text-slate-400">{edges.length} edges</span>
          <span className={exitCount === 0 ? 'text-red-400' : 'text-green-400'}>
            {exitCount} exit{exitCount !== 1 ? 's' : ''}
            {exitCount === 0 && ' ⚠ Add at least one exit'}
          </span>
        </div>

        {/* Selected node panel */}
        {selectedNodeData && (
          <div className="ml-auto bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs space-y-2 min-w-[200px]">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">Selected Node</p>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-white"
              >✕</button>
            </div>
            <p className="text-slate-400 font-mono">{selectedNodeData.id}</p>
            <div className="flex gap-1 flex-wrap">
              {(['room', 'corridor', 'hub', 'exit'] as GraphNode['type'][]).map(t => (
                <button
                  key={t}
                  onClick={() => setNodes(prev => prev.map(n => n.id === selectedNodeData.id ? { ...n, type: t } : n))}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors capitalize ${
                    selectedNodeData.type === t
                      ? 'border-red-500 text-red-300 bg-red-950/30'
                      : 'border-slate-600 text-slate-400 hover:border-slate-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {selectedEdges.length > 0 && (
              <div>
                <p className="text-slate-500 mb-1">Connected edges:</p>
                {selectedEdges.map(e => {
                  const other = e.from === selected ? e.to : e.from;
                  return (
                    <div key={`${e.from}-${e.to}`} className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">→ {other}</span>
                      <button
                        onClick={() => deleteEdge(e.from, e.to)}
                        className="text-red-500 hover:text-red-400 text-xs"
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {[
          { color: '#60a5fa', label: 'Room' },
          { color: '#a78bfa', label: 'Corridor' },
          { color: '#fbbf24', label: 'Hub' },
          { color: '#22c55e', label: 'Exit' },
          { color: '#ef4444', label: 'Fire' },
          { color: '#00ff88', label: 'Safe path' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="ml-auto text-slate-600">Drag nodes to reposition</span>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-4 text-white text-xs px-3 py-2 rounded-lg z-50 shadow-lg ${
          toast.ok !== false ? 'bg-slate-800 border border-slate-600' : 'bg-red-950 border border-red-800'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
