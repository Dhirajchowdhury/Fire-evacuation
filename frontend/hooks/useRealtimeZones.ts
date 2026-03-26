'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ZoneStatus, ZoneAlert } from '../../shared/types';

interface UseRealtimeZonesResult {
  zones: ZoneStatus[];
  alerts: ZoneAlert[];
  isLoading: boolean;
  error: string | null;
}

export function useRealtimeZones(): UseRealtimeZonesResult {
  const [zones, setZones] = useState<ZoneStatus[]>([]);
  const [alerts, setAlerts] = useState<ZoneAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitial() {
      try {
        const [zonesRes, alertsRes] = await Promise.all([
          supabase.from('zones').select('*').order('zone_id'),
          supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(20),
        ]);

        if (zonesRes.error) throw new Error(zonesRes.error.message);
        if (alertsRes.error) throw new Error(alertsRes.error.message);

        if (!cancelled) {
          setZones(zonesRes.data as ZoneStatus[]);
          setAlerts(alertsRes.data as ZoneAlert[]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchInitial();

    // Subscribe to zone updates
    const zonesChannel = supabase
      .channel('realtime:zones')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'zones' },
        (payload) => {
          const updated = payload.new as ZoneStatus;
          setZones((prev) =>
            prev.map((z) => (z.zone_id === updated.zone_id ? updated : z))
          );
        }
      )
      .subscribe();

    // Subscribe to new alerts
    const alertsChannel = supabase
      .channel('realtime:alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const newAlert = payload.new as ZoneAlert;
          setAlerts((prev) => [newAlert, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(zonesChannel);
      supabase.removeChannel(alertsChannel);
    };
  }, []);

  return { zones, alerts, isLoading, error };
}
