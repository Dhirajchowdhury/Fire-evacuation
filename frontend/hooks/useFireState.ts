'use client';
/**
 * useFireState — unified real-time fire state hook.
 *
 * Subscribes to BOTH tables:
 *   - esp32_nodes  (raw sensor data from ESP32SimPanel / real hardware)
 *   - hazard_nodes (manual fire sim from FireSimPanel)
 *
 * Merges both into a single Set<nodeId> of fire nodes.
 * Used by the map page and admin dashboard.
 *
 * Also exposes isEmergency = true if ANY node is on fire.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { computeStatus } from './useESP32Nodes';

interface FireStateResult {
  fireNodeIds: Set<string>;   // all node IDs currently on fire
  isEmergency: boolean;       // true if any fire
  isLoading: boolean;
}

export function useFireState(workspaceId: string | null): FireStateResult {
  const [esp32Fire, setEsp32Fire]   = useState<Set<string>>(new Set());
  const [hazardFire, setHazardFire] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading]   = useState(true);
  const loadCount = useRef(0);

  function markLoaded() {
    loadCount.current += 1;
    if (loadCount.current >= 2) setIsLoading(false);
  }

  // ── esp32_nodes subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) { markLoaded(); return; }

    supabase
      .from('esp32_nodes')
      .select('node_name, smoke_value, flame_status, status')
      .eq('workspace_id', workspaceId)
      .then(({ data }) => {
        const fires = new Set<string>();
        (data ?? []).forEach((r: { node_name: string; smoke_value: number; flame_status: 0 | 1; status: string }) => {
          if (computeStatus(r.smoke_value, r.flame_status) === 'fire') fires.add(r.node_name);
        });
        setEsp32Fire(fires);
        markLoaded();
      });

    const ch = supabase
      .channel(`esp32-fire-${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'esp32_nodes',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { node_name: string };
          setEsp32Fire(prev => { const s = new Set(prev); s.delete(old.node_name); return s; });
          return;
        }
        const row = payload.new as { node_name: string; smoke_value: number; flame_status: 0 | 1 };
        const isFire = computeStatus(row.smoke_value, row.flame_status) === 'fire';
        setEsp32Fire(prev => {
          const s = new Set(prev);
          isFire ? s.add(row.node_name) : s.delete(row.node_name);
          return s;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // ── hazard_nodes subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) { markLoaded(); return; }

    supabase
      .from('hazard_nodes')
      .select('node_id, status')
      .eq('workspace_id', workspaceId)
      .then(({ data }) => {
        const fires = new Set<string>();
        (data ?? []).forEach((r: { node_id: string; status: string }) => {
          if (r.status === 'fire') fires.add(r.node_id);
        });
        setHazardFire(fires);
        markLoaded();
      });

    const ch = supabase
      .channel(`hazard-fire-${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hazard_nodes',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { node_id: string };
          setHazardFire(prev => { const s = new Set(prev); s.delete(old.node_id); return s; });
          return;
        }
        const row = payload.new as { node_id: string; status: string };
        setHazardFire(prev => {
          const s = new Set(prev);
          row.status === 'fire' ? s.add(row.node_id) : s.delete(row.node_id);
          return s;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Merge both sources
  const fireNodeIds = new Set([...esp32Fire, ...hazardFire]);

  return {
    fireNodeIds,
    isEmergency: fireNodeIds.size > 0,
    isLoading,
  };
}
