'use client';
/**
 * useRealtimeHazards — subscribes to hazard_nodes table changes.
 * Returns a map of nodeId → status for instant lookup.
 * Used by both the admin debug panel and the /map/[workspaceId] page.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface HazardNode {
  id: string;
  node_id: string;
  status: 'safe' | 'fire';
  severity: number;
  updated_at: string;
}

interface UseRealtimeHazardsResult {
  hazards: Map<string, HazardNode>;   // nodeId → HazardNode
  fireNodeIds: Set<string>;           // quick lookup
  isLoading: boolean;
}

export function useRealtimeHazards(workspaceId: string | null): UseRealtimeHazardsResult {
  const [hazards, setHazards]   = useState<Map<string, HazardNode>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const applyRow = useCallback((row: HazardNode) => {
    setHazards(prev => {
      const next = new Map(prev);
      next.set(row.node_id, row);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!workspaceId) { setIsLoading(false); return; }

    // Initial load
    supabase
      .from('hazard_nodes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .then(({ data }) => {
        const map = new Map<string, HazardNode>();
        (data ?? []).forEach((r: HazardNode) => map.set(r.node_id, r));
        setHazards(map);
        setIsLoading(false);
      });

    // Realtime subscription
    const ch = supabase
      .channel(`hazards-${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hazard_nodes',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as HazardNode;
          setHazards(prev => { const n = new Map(prev); n.delete(old.node_id); return n; });
        } else {
          applyRow(payload.new as HazardNode);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [workspaceId, applyRow]);

  const fireNodeIds = new Set(
    [...hazards.values()].filter(h => h.status === 'fire').map(h => h.node_id)
  );

  return { hazards, fireNodeIds, isLoading };
}
