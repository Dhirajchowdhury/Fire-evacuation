'use client';
/**
 * EvacuationCanvas — renders floor plan image + node overlay + safe path
 * on an HTML5 Canvas. Fully responsive, mobile-first.
 */
import { useEffect, useRef, useCallback } from 'react';
import type { GraphNode, GraphEdge } from '../../lib/astar';

interface Props {
  imageUrl: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  path: string[];          // ordered node IDs of safe route
  selectedNode: string | null;
  onNodeClick?: (id: string) => void;
  editMode?: boolean;      // admin: click to place/select nodes
  onCanvasClick?: (x: number, y: number) => void; // admin: place node
}

const NODE_R   = 10;   // radius px
const PATH_W   = 4;    // path line width

const COLORS = {
  room:     '#60a5fa',  // blue
  corridor: '#a78bfa',  // purple
  hub:      '#fbbf24',  // amber
  exit:     '#22c55e',  // green
  fire:     '#ef4444',  // red
  path:     '#00ff88',  // neon green
  selected: '#ffffff',
  edge:     'rgba(255,255,255,0.15)',
};

export default function EvacuationCanvas({
  imageUrl, nodes, edges, path, selectedNode,
  onNodeClick, editMode, onCanvasClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const animRef   = useRef<number>(0);
  const dashOffset = useRef(0);

  // Convert % coords to canvas px
  function toCanvas(x: number, y: number, w: number, h: number) {
    return { cx: (x / 100) * w, cy: (y / 100) * h };
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background image
    if (img && img.complete) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Draw edges
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 1.5;
    for (const e of edges) {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) continue;
      const { cx: ax, cy: ay } = toCanvas(a.x, a.y, W, H);
      const { cx: bx, cy: by } = toCanvas(b.x, b.y, W, H);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // Draw animated safe path
    if (path.length > 1) {
      ctx.save();
      ctx.strokeStyle = COLORS.path;
      ctx.lineWidth   = PATH_W;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -dashOffset.current;
      ctx.shadowColor = COLORS.path;
      ctx.shadowBlur  = 12;

      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const n = nodeMap.get(path[i]);
        if (!n) continue;
        const { cx, cy } = toCanvas(n.x, n.y, W, H);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw nodes
    for (const n of nodes) {
      const { cx, cy } = toCanvas(n.x, n.y, W, H);
      const isFire     = n.status === 'fire';
      const isExit     = n.type === 'exit';
      const isSelected = n.id === selectedNode;
      const isOnPath   = path.includes(n.id);

      ctx.save();

      // Fire pulse effect
      if (isFire) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur  = 16 + pulse * 12;
      } else if (isOnPath) {
        ctx.shadowColor = COLORS.path;
        ctx.shadowBlur  = 10;
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(cx, cy, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = isFire ? COLORS.fire
        : isExit ? COLORS.exit
        : COLORS[n.type] ?? '#888';
      ctx.fill();

      // Selected ring
      if (isSelected) {
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth   = 2.5;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle   = '#fff';
      ctx.font        = `bold ${isExit ? 11 : 9}px sans-serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isExit ? '🚪' : isFire ? '🔥' : n.type[0].toUpperCase(), cx, cy);

      ctx.restore();
    }

    // Animate
    dashOffset.current = (dashOffset.current + 0.5) % 20;
    animRef.current = requestAnimationFrame(draw);
  }, [nodes, edges, path, selectedNode]);

  // Load image
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => { imgRef.current = img; };
  }, [imageUrl]);

  // Start animation loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Click handler
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const W  = canvas.width;
    const H  = canvas.height;

    // Check if clicked on a node
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const n of nodes) {
      const { cx, cy } = { cx: (n.x / 100) * W, cy: (n.y / 100) * H };
      if (Math.hypot(px - cx, py - cy) <= NODE_R + 4) {
        onNodeClick?.(n.id);
        return;
      }
    }

    // Admin: place new node
    if (editMode && onCanvasClick) {
      onCanvasClick((px / W) * 100, (py / H) * 100);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full h-full"
      style={{ cursor: editMode ? 'crosshair' : 'pointer', touchAction: 'none' }}
    />
  );
}
