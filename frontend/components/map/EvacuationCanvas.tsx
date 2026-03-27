'use client';
/**
 * EvacuationCanvas — HTML5 Canvas map editor + viewer.
 * - DPR-aware (sharp on retina/mobile)
 * - Drag nodes, click-to-place, edge creation
 * - Animated dashed path + directional arrow
 * - Fire nodes: blinking + outer glow ring
 * - Touch support via pointer events
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
  onNodeDrag?: (id: string, x: number, y: number) => void;
  editMode?: boolean;
  onCanvasClick?: (x: number, y: number) => void;
}

// Scale node radius with canvas logical size
const BASE_R  = 11;
const PATH_W  = 5;
const ARROW_L = 16; // arrow head length px

const COLORS: Record<string, string> = {
  room:     '#60a5fa',
  corridor: '#a78bfa',
  hub:      '#fbbf24',
  exit:     '#22c55e',
  fire:     '#ff3b2f',
  path:     '#00ff88',
  edge:     'rgba(255,255,255,0.18)',
  selected: '#ffffff',
  bg:       '#0a0a0a',
};

const NODE_ICONS: Record<string, string> = {
  room: 'R', corridor: 'C', hub: 'H', exit: '🚪',
};

export default function EvacuationCanvas({
  imageUrl, nodes, edges, path, selectedNode,
  onNodeClick, onNodeDrag, editMode, onCanvasClick,
}: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const imgRef      = useRef<HTMLImageElement | null>(null);
  const animRef     = useRef<number>(0);
  const dashOff     = useRef(0);
  const dpr         = useRef(1);

  const dragging    = useRef<string | null>(null);
  const dragOffset  = useRef({ x: 0, y: 0 });
  const hoveredNode = useRef<string | null>(null);
  const [localPos, setLocalPos] = useState<Map<string, { x: number; y: number }>>(new Map());

  function getPos(n: GraphNode) {
    return localPos.get(n.id) ?? { x: n.x, y: n.y };
  }

  // Convert % → logical canvas px (before DPR scaling)
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
      if (Math.hypot(px - cx, py - cy) <= BASE_R + 8) return n.id;
    }
    return null;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Logical size (CSS pixels)
    const W = canvas.width  / dpr.current;
    const H = canvas.height / dpr.current;

    ctx.save();
    ctx.scale(dpr.current, dpr.current);
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Floor plan image
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      ctx.globalAlpha = 0.62;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const t = Date.now();

    // ── Edges ──────────────────────────────────────────────────────────────
    for (const e of edges) {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) continue;
      const pa = getPos(a), pb = getPos(b);
      const { cx: ax, cy: ay } = toPx(pa.x, pa.y, W, H);
      const { cx: bx, cy: by } = toPx(pb.x, pb.y, W, H);
      ctx.save();
      ctx.strokeStyle = e.blocked ? 'rgba(255,59,47,0.35)' : COLORS.edge;
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
      // Collect path points
      const pts: { cx: number; cy: number }[] = [];
      for (const id of path) {
        const n = nodeMap.get(id);
        if (!n) continue;
        pts.push(toPx(getPos(n).x, getPos(n).y, W, H));
      }

      if (pts.length > 1) {
        // Glow pass
        ctx.save();
        ctx.strokeStyle = 'rgba(0,255,136,0.25)';
        ctx.lineWidth   = PATH_W + 8;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy));
        ctx.stroke();
        ctx.restore();

        // Main animated dashed line
        ctx.save();
        ctx.strokeStyle = COLORS.path;
        ctx.lineWidth   = PATH_W;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.setLineDash([14, 8]);
        ctx.lineDashOffset = -dashOff.current;
        ctx.shadowColor = COLORS.path;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy));
        ctx.stroke();
        ctx.restore();

        // ── Directional arrow at exit ──────────────────────────────────────
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const angle = Math.atan2(last.cy - prev.cy, last.cx - prev.cx);

        ctx.save();
        ctx.translate(last.cx, last.cy);
        ctx.rotate(angle);
        ctx.fillStyle = COLORS.path;
        ctx.shadowColor = COLORS.path;
        ctx.shadowBlur  = 18;
        // Arrow head — larger for mobile visibility
        ctx.beginPath();
        ctx.moveTo(ARROW_L, 0);
        ctx.lineTo(-ARROW_L * 0.6, ARROW_L * 0.55);
        ctx.lineTo(-ARROW_L * 0.3, 0);
        ctx.lineTo(-ARROW_L * 0.6, -ARROW_L * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Pulsing ring at start node
        const start = pts[0];
        const pulse = 0.5 + 0.5 * Math.sin(t / 400);
        ctx.save();
        ctx.strokeStyle = `rgba(0,255,136,${0.3 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(start.cx, start.cy, BASE_R + 6 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
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

      if (isFire) {
        // ── Fire: blinking outer ring + pulsing glow ──────────────────────
        const blink  = 0.4 + 0.6 * Math.abs(Math.sin(t / 280));   // 0.4–1.0
        const pulseR = BASE_R + 4 + 6 * Math.abs(Math.sin(t / 350));

        // Far glow
        const grad = ctx.createRadialGradient(cx, cy, BASE_R, cx, cy, pulseR + 10);
        grad.addColorStop(0, `rgba(255,59,47,${blink * 0.5})`);
        grad.addColorStop(1, 'rgba(255,59,47,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR + 10, 0, Math.PI * 2);
        ctx.fill();

        // Blinking outer ring
        ctx.strokeStyle = `rgba(255,59,47,${blink})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowColor = '#ff3b2f';
        ctx.shadowBlur  = 20 + blink * 14;

      } else if (isOnPath) {
        ctx.shadowColor = COLORS.path;
        ctx.shadowBlur  = 12;
      } else if (isSelected || isHovered) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur  = 8;
      }

      const r = isDragged ? BASE_R + 3 : isHovered ? BASE_R + 2 : BASE_R;

      // Exit double ring
      if (isExit) {
        const exitPulse = 0.3 + 0.3 * Math.sin(t / 600);
        ctx.strokeStyle = `rgba(34,197,94,${0.4 + exitPulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Node fill
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isFire ? COLORS.fire : (COLORS[n.type] ?? '#888');
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered && editMode) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Icon
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${isExit ? 11 : 9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isFire ? '🔥' : (NODE_ICONS[n.type] ?? '?'), cx, cy);

      // ID label in edit mode
      if (editMode) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '8px sans-serif';
        ctx.fillText(n.id.split('_')[0], cx, cy + r + 9);
      }

      ctx.restore();
    }

    ctx.restore(); // undo DPR scale

    dashOff.current = (dashOff.current + 0.7) % 22;
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

  // DPR-aware resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function resize() {
      if (!canvas) return;
      const d = window.devicePixelRatio || 1;
      dpr.current = d;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width  = w * d;
      canvas.height = h * d;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Reset local positions when node list changes
  useEffect(() => { setLocalPos(new Map()); }, [nodes.length]);

  // ── Pointer helpers ────────────────────────────────────────────────────────
  function getLogicalXY(e: React.PointerEvent | React.MouseEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Convert to logical (CSS) pixels
    const W = canvas.width  / dpr.current;
    const H = canvas.height / dpr.current;
    return {
      px: (e.clientX - rect.left) * (W / rect.width),
      py: (e.clientY - rect.top)  * (H / rect.height),
      W, H,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const { px, py, W, H } = getLogicalXY(e);
    const hit = nodeAt(px, py, W, H);
    if (hit && editMode) {
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
    const { px, py, W, H } = getLogicalXY(e);
    if (dragging.current) {
      const nx = px - dragOffset.current.x;
      const ny = py - dragOffset.current.y;
      const pct = toPct(nx, ny, W, H);
      setLocalPos(prev => new Map(prev).set(dragging.current!, {
        x: Math.max(0, Math.min(100, pct.x)),
        y: Math.max(0, Math.min(100, pct.y)),
      }));
      return;
    }
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
      const { px, py, W, H } = getLogicalXY(e);
      const pct = toPct(px - dragOffset.current.x, py - dragOffset.current.y, W, H);
      onNodeDrag?.(dragging.current, Math.max(0, Math.min(100, pct.x)), Math.max(0, Math.min(100, pct.y)));
      dragging.current = null;
    }
  }

  function handleClick(e: React.MouseEvent) {
    const { px, py, W, H } = getLogicalXY(e);
    const hit = nodeAt(px, py, W, H);
    if (hit) { onNodeClick?.(hit); return; }
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
      className="w-full h-full touch-none select-none block"
      style={{ cursor: editMode ? 'crosshair' : 'default' }}
    />
  );
}
