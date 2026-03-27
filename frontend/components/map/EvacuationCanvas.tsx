'use client';
/**
 * EvacuationCanvas — Real-time evacuation map with strong visual zone feedback.
 *
 * Render layers (bottom → top):
 *   1. Floor plan image (dimmed to let zones show through)
 *   2. Zone glow — FIRE = solid red pulse, SAFE = solid green pulse
 *   3. Graph edges
 *   4. Path glow + animated dashed line
 *   5. Inline direction arrows every ~52px
 *   6. Node circles with gradient fill
 *   7. Edit mode labels
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import type { GraphNode, GraphEdge } from '../../lib/astar';

interface Props {
  imageUrl: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  allPaths: { path: string[]; exitId: string; cost: number }[];
  activePath: number;
  selectedNode: string | null;
  onNodeClick?: (id: string) => void;
  onNodeDrag?: (id: string, x: number, y: number) => void;
  editMode?: boolean;
  onCanvasClick?: (x: number, y: number) => void;
}

const BASE_R        = 12;
const PATH_W        = 5;
const ARROW_SPACING = 52;
const ARROW_SIZE    = 9;

const C = {
  room:     '#60a5fa',
  corridor: '#a78bfa',
  hub:      '#fbbf24',
  exit:     '#22c55e',
  fire:     '#ff3b2f',
  path:     '#00ff88',
  edge:     'rgba(255,255,255,0.15)',
  bg:       '#080808',
};

const ICONS: Record<string, string> = {
  room: 'R', corridor: 'C', hub: 'H', exit: '🚪',
};

// Walk a polyline and return evenly-spaced sample points with angle
function samplePolyline(
  pts: { cx: number; cy: number }[],
  spacing: number
): { cx: number; cy: number; angle: number }[] {
  const result: { cx: number; cy: number; angle: number }[] = [];
  if (pts.length < 2) return result;
  let accumulated = spacing / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].cx, ay = pts[i].cy;
    const bx = pts[i + 1].cx, by = pts[i + 1].cy;
    const segLen = Math.hypot(bx - ax, by - ay);
    const angle  = Math.atan2(by - ay, bx - ax);
    let d = accumulated;
    while (d <= segLen) {
      const t = d / segLen;
      result.push({ cx: ax + (bx - ax) * t, cy: ay + (by - ay) * t, angle });
      d += spacing;
    }
    accumulated = d - segLen;
  }
  return result;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  angle: number, size: number, alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size * 1.4, 0);
  ctx.lineTo(-size * 0.7, size * 0.8);
  ctx.lineTo(-size * 0.2, 0);
  ctx.lineTo(-size * 0.7, -size * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8)  & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, ( n        & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

export default function EvacuationCanvas({
  imageUrl, nodes, edges, allPaths, activePath, selectedNode,
  onNodeClick, onNodeDrag, editMode, onCanvasClick,
}: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const imgRef      = useRef<HTMLImageElement | null>(null);
  const animRef     = useRef<number>(0);
  const dashOff     = useRef(0);
  const arrowOff    = useRef(0);
  const dpr         = useRef(1);
  const dragging    = useRef<string | null>(null);
  const dragOffset  = useRef({ x: 0, y: 0 });
  const hoveredNode = useRef<string | null>(null);
  const [localPos, setLocalPos] = useState<Map<string, { x: number; y: number }>>(new Map());

  function getPos(n: GraphNode) {
    return localPos.get(n.id) ?? { x: n.x, y: n.y };
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
      if (Math.hypot(px - cx, py - cy) <= BASE_R + 8) return n.id;
    }
    return null;
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width  / dpr.current;
    const H = canvas.height / dpr.current;
    const t = Date.now();

    ctx.save();
    ctx.scale(dpr.current, dpr.current);
    ctx.clearRect(0, 0, W, H);

    // ── LAYER 1: Background + floor plan ──────────────────────────────────
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      // Dimmed so zone glows are clearly visible on top
      ctx.globalAlpha = 0.42;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // ── LAYER 2: Zone status areas — large filled regions ─────────────────
    for (const n of nodes) {
      const pos = getPos(n);
      const { cx, cy } = toPx(pos.x, pos.y, W, H);
      const isFire = n.status === 'fire';

      // Zone area — large rectangle behind the node
      const zoneW = W * 0.18;  // 18% of canvas width
      const zoneH = H * 0.22;  // 22% of canvas height

      if (isFire) {
        const phase   = (t % 1200) / 1200;
        const opacity = 0.55 + 0.35 * Math.sin(phase * Math.PI);

        // Solid red zone fill
        ctx.save();
        ctx.globalAlpha = opacity * 0.4;
        ctx.fillStyle   = '#ff1a00';
        ctx.beginPath();
        ctx.roundRect(cx - zoneW / 2, cy - zoneH / 2, zoneW, zoneH, 8);
        ctx.fill();
        ctx.restore();

        // Red zone border
        ctx.save();
        ctx.strokeStyle = `rgba(255,50,0,${opacity})`;
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = '#ff3b00';
        ctx.shadowBlur  = 18;
        ctx.beginPath();
        ctx.roundRect(cx - zoneW / 2, cy - zoneH / 2, zoneW, zoneH, 8);
        ctx.stroke();
        ctx.restore();

        // Pulsing glow circle
        const scale = 1 + 0.5 * Math.sin(phase * Math.PI);
        const r     = BASE_R * 3 * scale;
        const grad  = ctx.createRadialGradient(cx, cy, BASE_R, cx, cy, r);
        grad.addColorStop(0,   `rgba(255,20,0,${opacity * 0.7})`);
        grad.addColorStop(1,   'rgba(255,0,0,0)');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else {
        const phase   = (t % 2000) / 2000;
        const opacity = 0.35 + 0.2 * Math.sin(phase * Math.PI);

        // Solid green zone fill
        ctx.save();
        ctx.globalAlpha = opacity * 0.3;
        ctx.fillStyle   = '#00ff64';
        ctx.beginPath();
        ctx.roundRect(cx - zoneW / 2, cy - zoneH / 2, zoneW, zoneH, 8);
        ctx.fill();
        ctx.restore();

        // Green zone border
        ctx.save();
        ctx.strokeStyle = `rgba(0,255,100,${opacity * 0.8})`;
        ctx.lineWidth   = 1.5;
        ctx.shadowColor = '#00ff64';
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.roundRect(cx - zoneW / 2, cy - zoneH / 2, zoneW, zoneH, 8);
        ctx.stroke();
        ctx.restore();

        // Soft glow circle
        const scale = 1 + 0.2 * Math.sin(phase * Math.PI);
        const r     = BASE_R * 2.4 * scale;
        const grad  = ctx.createRadialGradient(cx, cy, BASE_R, cx, cy, r);
        grad.addColorStop(0,   `rgba(0,255,100,${opacity * 0.55})`);
        grad.addColorStop(1,   'rgba(0,255,100,0)');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ── LAYER 3: Graph edges ───────────────────────────────────────────────
    for (const e of edges) {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) continue;
      const pa = getPos(a), pb = getPos(b);
      const { cx: ax, cy: ay } = toPx(pa.x, pa.y, W, H);
      const { cx: bx, cy: by } = toPx(pb.x, pb.y, W, H);
      ctx.save();
      ctx.strokeStyle = e.blocked ? 'rgba(255,59,47,0.35)' : C.edge;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash(e.blocked ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
    }

    // ── LAYER 4 + 5: All paths (dimmed) + active path (bright) ───────────
    const activePathIds = allPaths[activePath]?.path ?? [];

    // Draw non-active paths first (dimmed, thinner)
    for (let pi = 0; pi < allPaths.length; pi++) {
      if (pi === activePath) continue;
      const pts: { cx: number; cy: number }[] = [];
      for (const id of allPaths[pi].path) {
        const n = nodeMap.get(id);
        if (!n) continue;
        pts.push(toPx(getPos(n).x, getPos(n).y, W, H));
      }
      if (pts.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,255,136,0.2)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy));
      ctx.stroke();
      ctx.restore();
    }

    // Draw active path (bright, animated, with arrows)
    if (activePathIds.length > 1) {
      const pts: { cx: number; cy: number }[] = [];
      for (const id of activePathIds) {
        const n = nodeMap.get(id);
        if (!n) continue;
        pts.push(toPx(getPos(n).x, getPos(n).y, W, H));
      }

      if (pts.length > 1) {
        // Wide outer glow
        ctx.save();
        ctx.strokeStyle = 'rgba(0,255,136,0.15)';
        ctx.lineWidth   = PATH_W + 12;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy));
        ctx.stroke();
        ctx.restore();

        // Medium glow
        ctx.save();
        ctx.strokeStyle = 'rgba(0,255,136,0.32)';
        ctx.lineWidth   = PATH_W + 5;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy));
        ctx.stroke();
        ctx.restore();

        // Animated dashed core
        ctx.save();
        ctx.strokeStyle    = C.path;
        ctx.lineWidth      = PATH_W;
        ctx.lineCap        = 'round';
        ctx.lineJoin       = 'round';
        ctx.setLineDash([16, 10]);
        ctx.lineDashOffset = -dashOff.current;
        ctx.shadowColor    = C.path;
        ctx.shadowBlur     = 12;
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy));
        ctx.stroke();
        ctx.restore();

        // Inline flowing arrows
        const arrowPts = samplePolyline(pts, ARROW_SPACING);
        ctx.save();
        ctx.fillStyle   = C.path;
        ctx.shadowColor = C.path;
        ctx.shadowBlur  = 8;
        for (const ap of arrowPts) {
          const scrolledCx = ap.cx + Math.cos(ap.angle) * (arrowOff.current % ARROW_SPACING);
          const scrolledCy = ap.cy + Math.sin(ap.angle) * (arrowOff.current % ARROW_SPACING);
          drawArrow(ctx, scrolledCx, scrolledCy, ap.angle, ARROW_SIZE, 0.85);
        }
        ctx.restore();

        // Terminal arrow at exit
        const last  = pts[pts.length - 1];
        const prev  = pts[pts.length - 2];
        const angle = Math.atan2(last.cy - prev.cy, last.cx - prev.cx);
        ctx.save();
        ctx.fillStyle   = C.path;
        ctx.shadowColor = C.path;
        ctx.shadowBlur  = 22;
        drawArrow(ctx, last.cx, last.cy, angle, ARROW_SIZE * 1.8, 1);
        ctx.restore();

        // "You are here" pulsing ring at start
        const start = pts[0];
        const pulse = 0.5 + 0.5 * Math.sin(t / 380);
        ctx.save();
        ctx.strokeStyle = `rgba(0,255,136,${0.4 + pulse * 0.45})`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(start.cx, start.cy, BASE_R + 7 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── LAYER 6: Nodes ─────────────────────────────────────────────────────
    for (const n of nodes) {
      const pos = getPos(n);
      const { cx, cy } = toPx(pos.x, pos.y, W, H);
      const isFire     = n.status === 'fire';
      const isExit     = n.type === 'exit';
      const isSelected = n.id === selectedNode;
      const isOnPath   = activePathIds.includes(n.id);
      const isHovered  = n.id === hoveredNode.current;
      const isDragged  = n.id === dragging.current;

      ctx.save();

      if (isFire) {
        const blink = 0.5 + 0.5 * Math.abs(Math.sin(t / 260));
        ctx.shadowColor = '#ff3b2f';
        ctx.shadowBlur  = 20 + blink * 16;
      } else if (isOnPath) {
        ctx.shadowColor = C.path;
        ctx.shadowBlur  = 14;
      } else if (isExit) {
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur  = 10;
      } else if (isSelected || isHovered) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur  = 8;
      }

      const r = isDragged ? BASE_R + 3 : isHovered ? BASE_R + 2 : BASE_R;

      if (isExit) {
        const ep = 0.3 + 0.3 * Math.sin(t / 700);
        ctx.strokeStyle = `rgba(34,197,94,${0.5 + ep})`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Gradient fill for depth
      const baseColor = isFire ? '#ff3b2f' : (C[n.type] ?? '#888');
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      grad.addColorStop(0, lighten(baseColor, 0.35));
      grad.addColorStop(1, baseColor);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 2.5;
        ctx.stroke();
      } else if (isHovered && editMode) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle    = '#fff';
      ctx.font         = `bold ${isExit ? 11 : 9}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isFire ? '🔥' : (ICONS[n.type] ?? '?'), cx, cy);

      if (editMode) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font      = '8px sans-serif';
        ctx.fillText(n.id.split('_')[0], cx, cy + r + 9);
      }

      ctx.restore();
    }

    ctx.restore();

    dashOff.current  = (dashOff.current  + 0.8) % 26;
    arrowOff.current = (arrowOff.current + 0.6) % ARROW_SPACING;
    animRef.current  = requestAnimationFrame(draw);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, allPaths, activePath, selectedNode, localPos]);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => { imgRef.current = img; };
  }, [imageUrl]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function resize() {
      if (!canvas) return;
      const d = window.devicePixelRatio || 1;
      dpr.current   = d;
      canvas.width  = canvas.offsetWidth  * d;
      canvas.height = canvas.offsetHeight * d;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setLocalPos(new Map()); }, [nodes.length]);

  function getLogicalXY(e: React.PointerEvent | React.MouseEvent) {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
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
      const pct = toPct(px - dragOffset.current.x, py - dragOffset.current.y, W, H);
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
