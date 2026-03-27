'use client';
/**
 * MapEditor — Admin tool to place nodes and draw edges on the floor plan.
 * Saves graph to workspaces.building_graph (JSONB).
 */
import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../../lib/supabase';
import type { GraphNode, GraphEdge } from '../../../../lib/astar';

const EvacuationCanvas = dynamic(() => import('../../../../components/map/EvacuationCanvas'), { ssr: false });

type Tool = 'node_room' | 'node_corridor' | 'node_exit' | 'node_hub' | 'edge' | 'delete';

interface Props {
  workspaceId: string;
  imageUrl: string;
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  onSaved: (nodes: GraphNode[], edges: GraphEdge[]) => void;
}

export default function MapEditor({ workspaceId, imageUrl, initialNodes, initialEdges, onSaved }: Props) {
  const [nodes, setNodes]       = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges]       = useState<GraphEdge[]>(initialEdges);
  const [tool, setTool]         = useState<Tool>('node_room');
  const [selected, setSelected] = useState<string | null>(null);
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  const handleCanvasClick = useCallback((x: number, y: number) => {
    if (!tool.startsWith('node_')) return;
    const type = tool.replace('node_', '') as GraphNode['type'];
    const id = `${type}_${Date.now()}`;
    setNodes(prev => [...prev, { id, x, y, type, status: 'safe' }]);
    showToast(`${type} node placed`);
  }, [tool]);

  const handleNodeClick = useCallback((id: string) => {
    if (tool === 'delete') {
      setNodes(prev => prev.filter(n => n.id !== id));
      setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
      showToast('Node deleted');
      return;
    }
    if (tool === 'edge') {
      if (!edgeStart) {
        setEdgeStart(id);
        setSelected(id);
        showToast('Now click the second node');
      } else if (edgeStart !== id) {
        // Check duplicate
        const exists = edges.some(e =>
          (e.from === edgeStart && e.to === id) || (e.from === id && e.to === edgeStart)
        );
        if (!exists) {
          setEdges(prev => [...prev, { from: edgeStart, to: id, blocked: false }]);
          showToast('Edge created');
        }
        setEdgeStart(null);
        setSelected(null);
      }
      return;
    }
    setSelected(id === selected ? null : id);
  }, [tool, edgeStart, edges, selected]);

  async function handleSave() {
    setSaving(true);
    const graph = { nodes, edges };
    const { error } = await supabase
      .from('workspaces')
      .update({ building_graph: graph })
      .eq('id', workspaceId);
    setSaving(false);
    if (error) { showToast('Save failed: ' + error.message); return; }
    showToast('Map saved!');
    onSaved(nodes, edges);
  }

  function handleClear() {
    if (!confirm('Clear all nodes and edges?')) return;
    setNodes([]); setEdges([]); setSelected(null); setEdgeStart(null);
  }

  const TOOLS: { id: Tool; label: string; color: string }[] = [
    { id: 'node_room',     label: '🏠 Room',     color: '#60a5fa' },
    { id: 'node_corridor', label: '🚶 Corridor', color: '#a78bfa' },
    { id: 'node_hub',      label: '⬡ Hub',       color: '#fbbf24' },
    { id: 'node_exit',     label: '🚪 Exit',     color: '#22c55e' },
    { id: 'edge',          label: '🔗 Edge',     color: '#94a3b8' },
    { id: 'delete',        label: '🗑 Delete',   color: '#ef4444' },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => { setTool(t.id); setEdgeStart(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              tool === t.id
                ? 'text-white border-transparent'
                : 'text-slate-400 border-slate-700 hover:border-slate-500'
            }`}
            style={tool === t.id ? { background: t.color + '33', borderColor: t.color, color: t.color } : {}}>
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={handleClear}
          className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-400 border border-slate-700 transition-colors">
          Clear All
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 transition-colors"
          style={{ background: '#ef4444' }}>
          {saving ? 'Saving...' : '💾 Save Map'}
        </button>
      </div>

      {/* Hint */}
      <p className="text-slate-500 text-xs">
        {tool === 'edge'
          ? edgeStart ? '→ Click second node to connect' : '→ Click first node to start edge'
          : tool === 'delete' ? '→ Click a node to delete it'
          : `→ Click on the map to place a ${tool.replace('node_', '')} node`}
      </p>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-700"
        style={{ height: '420px', background: '#0f172a' }}>
        <EvacuationCanvas
          imageUrl={imageUrl}
          nodes={nodes}
          edges={edges}
          path={[]}
          selectedNode={edgeStart ?? selected}
          onNodeClick={handleNodeClick}
          editMode={tool.startsWith('node_')}
          onCanvasClick={handleCanvasClick}
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} edges</span>
        <span>{nodes.filter(n => n.type === 'exit').length} exits</span>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-4 bg-slate-800 border border-slate-600 text-white text-xs px-3 py-2 rounded-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
