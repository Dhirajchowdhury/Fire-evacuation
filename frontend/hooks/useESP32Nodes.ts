'use client';
/**
 * useESP32Nodes — subscribes to esp32_nodes table.
 * Auto-interprets smoke_value + flame_status into fire/safe status.
 * Mirrors what real ESP32 hardware would send.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ESP32Node {
  id: number;
  node_name: string;
  status: 'safe' | 'fire';
  smoke_value: number;
  flame_status: 0 | 1;
  updated_at: string;
}

/** Client-side status logic — mirrors the DB trigger */
export function computeStatus(smoke: number, flame: 0 | 1): 'fire' | 'safe' {
  return smoke > 1500 || flame === 1 ? 'fire' : 'safe';
}

interface Result {
  nodes: ESP32Node[];
  fireNodes: ESP32Node[];
  safeNodes: ESP32Node[];
  isLoading: boolean;
}

export function useESP32Nodes(workspaceId: string | null): Result {
  const [nodes, setNodes]     = useState<ESP32Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const applyRow = useCallback((row: ESP32Node) => {
    // Re-compute status client-side in case trigger hasn't run yet
    const computed: ESP32Node = {
      ...row,
      status: computeStatus(row.smoke_value, row.flame_status),
    };
    setNodes(prev => {
      const idx = prev.findIndex(n => n.id === computed.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = computed;
        return next;
      }
      return [...prev, computed];
    });
  }, []);

  useEffect(() => {
    if (!workspaceId) { setIsLoading(false); return; }

    supabase
      .from('esp32_nodes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('node_name')
      .then(({ data }) => {
        setNodes((data ?? []).map((r: ESP32Node) => ({
          ...r,
          status: computeStatus(r.smoke_value, r.flame_status),
        })));
        setIsLoading(false);
      });

    const ch = supabase
      .channel(`esp32-${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'esp32_nodes',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setNodes(prev => prev.filter(n => n.id !== (payload.old as ESP32Node).id));
        } else {
          applyRow(payload.new as ESP32Node);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [workspaceId, applyRow]);

  return {
    nodes,
    fireNodes: nodes.filter(n => n.status === 'fire'),
    safeNodes: nodes.filter(n => n.status === 'safe'),
    isLoading,
  };
}
