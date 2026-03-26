import type { BuildingGraph, BuildingNode, ZoneStatus } from '../../shared/types';

export function resolveNodeStatuses(
  graph: BuildingGraph,
  zones: ZoneStatus[]
): BuildingNode[] {
  // Deep clone nodes — never mutate the source graph
  const nodes: BuildingNode[] = JSON.parse(JSON.stringify(graph.nodes));

  for (const node of nodes) {
    // Exits are always "exit" regardless of zone status
    if (node.type === 'exit') {
      node.status = 'exit';
      continue;
    }

    const matchingZone = zones.find((z) => z.zone_id === node.zone);
    if (matchingZone) {
      node.status = matchingZone.status === 'fire' ? 'fire' : 'safe';
    }
  }

  return nodes;
}
