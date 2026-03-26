const buildingGraph = require('../../shared/building-graph.json');

/**
 * BFS from startNode toward any of the exitNodes.
 * Returns the first (shortest) path found, or null.
 */
function bfs(adjacencyList, startNode, exitNodes) {
  const queue = [[startNode]];
  const visited = new Set([startNode]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (exitNodes.includes(current)) return path;

    for (const neighbor of (adjacencyList[current] || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

/**
 * Convert an array of node IDs to a human-readable label string.
 * e.g. ["room_3","corridor_2","exit_2"] → "Room 3 → Corridor 2 → Exit 2"
 */
function getRouteDescription(graph, nodeIds) {
  const labelMap = {};
  for (const node of graph.nodes) labelMap[node.id] = node.label;
  return nodeIds.map((id) => labelMap[id] || id).join(' → ');
}

/**
 * Find the shortest safe evacuation path given a list of fired zones.
 * Exit nodes are never blocked regardless of zone.
 *
 * @param {string[]} firedZones - e.g. ["A", "B"]
 * @returns {{ path: string[], exit: string, blocked_zones: string[], description: string } | null}
 */
function findEvacuationPath(firedZones) {
  // Deep clone so we never mutate the shared graph
  const graph = JSON.parse(JSON.stringify(buildingGraph));

  // Collect blocked node IDs (fire zones, but never exits)
  const blockedNodeIds = new Set(
    graph.nodes
      .filter((n) => n.type !== 'exit' && firedZones.includes(n.zone))
      .map((n) => n.id)
  );

  const exitNodeIds = graph.nodes
    .filter((n) => n.type === 'exit')
    .map((n) => n.id);

  // Build adjacency list excluding blocked nodes
  const adjacencyList = {};
  for (const node of graph.nodes) {
    if (!blockedNodeIds.has(node.id)) adjacencyList[node.id] = [];
  }
  for (const [a, b] of graph.edges) {
    if (!blockedNodeIds.has(a) && !blockedNodeIds.has(b)) {
      adjacencyList[a].push(b);
      adjacencyList[b].push(a);
    }
  }

  // Try BFS from every non-blocked, non-exit node; keep shortest path
  const startCandidates = graph.nodes
    .filter((n) => n.type !== 'exit' && !blockedNodeIds.has(n.id))
    .map((n) => n.id);

  let bestPath = null;
  for (const startNode of startCandidates) {
    const path = bfs(adjacencyList, startNode, exitNodeIds);
    if (path && (!bestPath || path.length < bestPath.length)) {
      bestPath = path;
    }
  }

  if (!bestPath) return null;

  const exit = bestPath[bestPath.length - 1];
  const fireZoneList = firedZones.join(', ');
  const routeLabel = getRouteDescription(graph, bestPath);

  return {
    path: bestPath,
    exit,
    blocked_zones: firedZones,
    description: `Zone ${fireZoneList} on fire. Route: ${routeLabel}`,
  };
}

module.exports = { findEvacuationPath, getRouteDescription };
