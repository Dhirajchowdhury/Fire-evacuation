'use client';
/**
 * EvacuationCanvas — HTML5 Canvas map editor + viewer.
 * Features: drag nodes, click-to-place, Shift+click edges,
 * animated path, fire pulse, touch support.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import type { GraphNode, GraphEdge } from '../../lib/astar';

interface Props {
  imageUrl: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  path: string[];
  selectedNode: string | null;
  onNodeClick?: (id: string) => void;
  onNodeDrag?: (id: string, x: number, y: number) => void; // % coords
  editMode?: boolean;
  onCanvasClick?: (x: number, y: number) => void;
}

const NODE_R = 11;
const PATH_W = 5;

const COLORS: Record<string, string> = {
  room:     '#60a5fa',
  corridor: '#a78bfa',
  hub:      '#fbbf24',
  exit:     '#22c55e',
  fire:     '#ef4444',
  path:     '#00ff88',
  edge:     'rgba(255,255,255,0.18)',
  edgeHover:'rgba(255,255,255,0.5)',
  selected: '#ffffff',
  bg:       '#0f172a',
};

const NODE_ICONS: Record<string, string> = {
  room: 'R', corridor: 'C', hub: 'H', exit: '🚪',
};

export default function EvacuationCanvas({
  imageUrl, nodes, edges, path, selectedNode,
  onNodeClick, onNodeDrag, editMode, onCanvasClick,
}: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgRef     = useRef<HTMLImageElement | null>(null);
  const animRef    = useRef<number>(0);
  const dashOff    = useRef(0);

  // Drag state
  const dragging   = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [localPos, setLocalPos] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Hover state for cursor feedback
  const hoveredNode = useRef<string | null>(null);

  // Merge saved positions with local drag overrides
  function getPos(n: GraphNode) {
    const local = localPos.get(n.id);
    return local ?? { x: n.x, y: n.y };
  }

  function toPx(x: number, y: number, W: number, H: number) {
    return { cx: (x / 100) * W, cy: (y / 100) * H };
  }

  function toPct(px: number, py: number, W: number, H: number) {
    return { x: (px / W) * 100, y: (py / H) * 100 };
  }

  function nodeAt(px: number, py: number, W: number, H: number): string | null {
    for (const n of [...nodes].reverse()) {
      const pos = getPos(n);
      const { cx, cy } = toPx(pos.x, pos.y, W, H);
      if (Math.hypot(px - cx, py - cy) <= NODE_R + 6) return n.id;
    }
    return null;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Floor plan image
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // ── Edges ──────────────────────────────────────────────────────────────
    for (const e of edges) {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) continue;
      const pa = getPos(a), pb = getPos(b);
      const { cx: ax, cy: ay } = toPx(pa.x, pa.y, W, H);
      const { cx: bx, cy: by } = toPx(pb.x, pb.y, W, H);

      ctx.save();
      ctx.strokeStyle = e.blocked ? 'rgba(239,68,68,0.4)' : COLORS.edge;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(e.blocked ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
    }

    // ── Animated safe path ─────────────────────────────────────────────────
    if (path.length > 1) {
      ctx.save();
      ctx.strokeStyle = COLORS.path;
      ctx.lineWidth   = PATH_W;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.setLineDash([14, 8]);
      ctx.lineDashOffset = -dashOff.current;
      ctx.shadowColor = COLORS.path;
      ctx.shadowBlur  = 16;
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const n = nodeMap.get(path[i]);
        if (!n) continue;
        const pos = getPos(n);
        const { cx, cy } = toPx(pos.x, pos.y, W, H);
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();

      // Arrow at end of path
      if (path.length >= 2) {
        const last = nodeMap.get(path[path.length - 1]);
        const prev = nodeMap.get(path[path.length - 2]);
        if (last && prev) {
          const lp = getPos(last), pp = getPos(prev);
          const { cx: lx, cy: ly } = toPx(lp.x, lp.y, W, H);
          const { cx: px2, cy: py2 } = toPx(pp.x, pp.y, W, H);
          const angle = Math.atan2(ly - py2, lx - px2);
          ctx.save();
          ctx.fillStyle = COLORS.path;
          ctx.shadowColor = COLORS.path;
          ctx.shadowBlur = 10;
          ctx.translate(lx, ly);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(-6, 5);
          ctx.lineTo(-6, -5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // ── Nodes ──────────────────────────────────────────────────────────────
    for (const n of nodes) {
      const pos = getPos(n);
      const { cx, cy } = toPx(pos.x, pos.y, W, H);
      const isFire     = n.status === 'fire';
      const isExit     = n.type === 'exit';
      const isSelected = n.id === selectedNode;
      const isOnPath   = path.includes(n.id);
      const isHovered  = n.id === hoveredNode.current;
      const isDragged  = n.id === dragging.current;

      ctx.save();

      // Glow
      if (isFire) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 180);
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur  = 20 + pulse * 16;
      } else if (isOnPath) {
        ctx.shadowColor = COLORS.path;
        ctx.shadowBlur  = 12;
      } else if (isSelected || isHovered) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur  = 8;
      }

      const r = isDragged ? NODE_R + 3 : isHovered ? NODE_R + 2 : NODE_R;

      // Outer ring for exit
      if (isExit) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34,197,94,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Node fill
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      const baseColor = isFire ? COLORS.fire : COLORS[n.type] ?? '#888';
      ctx.fillStyle = baseColor;
      ctx.fill();

      // Selected / hovered ring
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered && editMode) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Icon / label
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${isExit ? 10 : 9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = isFire ? '🔥' : NODE_ICONS[n.type] ?? '?';
      ctx.fillText(icon, cx, cy);

      // Node ID label below (edit mode only)
      if (editMode) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '8px sans-serif';
        ctx.fillText(n.id.split('_')[0], cx, cy + r + 8);
      }

      ctx.restore();
    }

    dashOff.current = (dashOff.current + 0.6) % 22;
    animRef.current = requestAnimationFrame(draw);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, path, selectedNode, localPos]);

  // Load image
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => { imgRef.current = img; };
  }, [imageUrl]);

  // Animation loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // Resize observer
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

  // Sync local positions when nodes prop changes (e.g. after save)
  useEffect(() => {
    setLocalPos(new Map());
  }, [nodes.length]);

  // ── Pointer helpers ────────────────────────────────────────────────────────
  function getCanvasXY(e: React.PointerEvent | React.MouseEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      px: (e.clientX - rect.left) * (canvas.width / rect.width),
      py: (e.clientY - rect.top)  * (canvas.height / rect.height),
      W: canvas.width, H: canvas.height,
    };
  }

  // ── Mouse / Pointer events ─────────────────────────────────────────────────
  function handlePointerDown(e: React.PointerEvent) {
    const { px, py, W, H } = getCanvasXY(e);
    const hit = nodeAt(px, py, W, H);

    if (hit && editMode) {
      // Start drag
      dragging.current = hit;
      const n = nodes.find(n => n.id === hit)!;
      const pos = getPos(n);
      const { cx, cy } = toPx(pos.x, pos.y, W, H);
      dragOffset.current = { x: px - cx, y: py - cy };
      canvasRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const { px, py, W, H } = getCanvasXY(e);

    if (dragging.current) {
      const nx = px - dragOffset.current.x;
      const ny = py - dragOffset.current.y;
      const pct = toPct(nx, ny, W, H);
      const clamped = {
        x: Math.max(0, Math.min(100, pct.x)),
        y: Math.max(0, Math.min(100, pct.y)),
      };
      setLocalPos(prev => new Map(prev).set(dragging.current!, clamped));
      return;
    }

    // Hover detection
    const hit = nodeAt(px, py, W, H);
    if (hit !== hoveredNode.current) {
      hoveredNode.current = hit;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = hit
          ? (editMode ? 'grab' : 'pointer')
          : (editMode ? 'crosshair' : 'default');
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragging.current) {
      const { px, py, W, H } = getCanvasXY(e);
      const pct = toPct(
        px - dragOffset.current.x,
        py - dragOffset.current.y,
        W, H
      );
      const clamped = {
        x: Math.max(0, Math.min(100, pct.x)),
        y: Math.max(0, Math.min(100, pct.y)),
      };
      onNodeDrag?.(dragging.current, clamped.x, clamped.y);
      dragging.current = null;
    }
  }

  function handleClick(e: React.MouseEvent) {
    const { px, py, W, H } = getCanvasXY(e);
    const hit = nodeAt(px, py, W, H);

    if (hit) {
      onNodeClick?.(hit);
      return;
    }

    if (editMode && onCanvasClick) {
      const pct = toPct(px, py, W, H);
      onCanvasClick(pct.x, pct.y);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { hoveredNode.current = null; dragging.current = null; }}
      className="w-full h-full touch-none select-none"
      style={{ cursor: editMode ? 'crosshair' : 'default' }}
    />
  );
}
