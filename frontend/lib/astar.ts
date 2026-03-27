/**
 * A* pathfinding on a 2D graph.
 * Nodes have x/y positions (percentage-based, 0-100).
 * Returns the shortest safe path from start to any exit node.
 */

export interface GraphNode {
  id: string;
  x: number;   // 0-100 percent
  y: number;   // 0-100 percent
  type: 'room' | 'corridor' | 'exit' | 'hub';
  status: 'safe' | 'fire';
}

export interface GraphEdge {
  from: string;
  to: string;
  blocked: boolean;
}

function dist(a: GraphNode, b: GraphNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function astar(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string
): string[] | null {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const exits   = nodes.filter(n => n.type === 'exit' && n.status !== 'fire').map(n => n.id);
  if (!exits.length) return null;

  // Build adjacency — skip blocked edges and fire nodes
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (e.blocked) continue;
    const from = nodeMap.get(e.from);
    const to   = nodeMap.get(e.to);
    if (!from || !to) continue;
    if (from.status === 'fire' || to.status === 'fire') continue;
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }

  const start = nodeMap.get(startId);
  if (!start || start.status === 'fire') return null;

  // Heuristic: min distance to any exit
  function h(id: string): number {
    const n = nodeMap.get(id)!;
    return Math.min(...exits.map(eid => dist(n, nodeMap.get(eid)!)));
  }

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const open = new Set<string>();

  gScore.set(startId, 0);
  fScore.set(startId, h(startId));
  open.add(startId);

  while (open.size > 0) {
    // Pick node with lowest fScore
    let current = '';
    let best = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < best) { best = f; current = id; }
    }

    if (exits.includes(current)) {
      // Reconstruct path
      const path: string[] = [];
      let c: string | undefined = current;
      while (c) { path.unshift(c); c = cameFrom.get(c); }
      return path;
    }

    open.delete(current);
    const curNode = nodeMap.get(current)!;

    for (const neighborId of (adj.get(current) ?? [])) {
      const neighbor = nodeMap.get(neighborId)!;
      const tentativeG = (gScore.get(current) ?? Infinity) + dist(curNode, neighbor);
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + h(neighborId));
        open.add(neighborId);
      }
    }
  }

  return null; // No path found
}
