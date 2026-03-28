/**
 * A* pathfinding on a 2D graph.
 * Nodes have x/y positions (percentage-based, 0-100).
 */

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  type: 'room' | 'corridor' | 'exit' | 'hub';
  status: 'safe' | 'fire';
}

export interface GraphEdge {
  from: string;
  to: string;
  blocked: boolean;
}

export interface PathResult {
  path: string[];
  exitId: string;
  cost: number;
}

function dist(a: GraphNode, b: GraphNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildAdj(nodes: GraphNode[], edges: GraphEdge[]): Map<string, string[]> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
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
  return adj;
}

/**
 * A* to a single specific exit.
 * Returns path + cost, or null if unreachable.
 */
function astarToExit(
  nodes: GraphNode[],
  adj: Map<string, string[]>,
  startId: string,
  exitId: string
): PathResult | null {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const start   = nodeMap.get(startId);
  const goal    = nodeMap.get(exitId);
  if (!start || !goal || start.status === 'fire') return null;

  const fireNodes = nodes.filter(n => n.status === 'fire');

  const gScore   = new Map<string, number>();
  const fScore   = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const open     = new Set<string>();

  gScore.set(startId, 0);
  fScore.set(startId, dist(start, goal));
  open.add(startId);

  while (open.size > 0) {
    let current = '';
    let best = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < best) { best = f; current = id; }
    }

    if (current === exitId) {
      const path: string[] = [];
      let c: string | undefined = current;
      while (c) { path.unshift(c); c = cameFrom.get(c); }
      return { path, exitId, cost: gScore.get(exitId) ?? Infinity };
    }

    open.delete(current);
    const curNode = nodeMap.get(current)!;

    for (const neighborId of (adj.get(current) ?? [])) {
      const neighbor = nodeMap.get(neighborId)!;
      
      let dangerPenalty = 0;
      for (const fn of fireNodes) {
        const d = dist(neighbor, fn);
        if (d < 25) { // Arbitrary threshold for "near fire"
           dangerPenalty += 2000 / Math.max(d, 0.1);
        }
      }

      const stepCost = dist(curNode, neighbor) + dangerPenalty;
      const tentativeG = (gScore.get(current) ?? Infinity) + stepCost;
      
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + dist(neighbor, goal));
        open.add(neighborId);
      }
    }
  }
  return null;
}

/**
 * Find paths from startId to ALL reachable safe exits.
 * Returns array sorted by cost (shortest first).
 * The first element is the recommended path.
 */
export function astarAllPaths(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string
): PathResult[] {
  const exits = nodes.filter(n => n.type === 'exit' && n.status !== 'fire');
  if (!exits.length) return [];

  const adj     = buildAdj(nodes, edges);
  const results: PathResult[] = [];

  for (const exit of exits) {
    const result = astarToExit(nodes, adj, startId, exit.id);
    if (result) results.push(result);
  }

  // Sort by cost — shortest path first
  results.sort((a, b) => a.cost - b.cost);
  return results;
}

/**
 * Original single-path A* — kept for backward compatibility.
 * Returns the shortest safe path to any exit.
 */
export function astar(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string
): string[] | null {
  const results = astarAllPaths(nodes, edges, startId);
  return results.length > 0 ? results[0].path : null;
}
