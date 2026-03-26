'use client';
/**
 * useAuth — Session tracking hook.
 *
 * Responsibilities:
 * - Track whether an admin is logged in (session exists)
 * - Expose signOut
 *
 * Role enforcement is handled by:
 * - middleware.ts (server-side, every request)
 * - AuthModal.tsx (at login time)
 * - admin/layout.tsx (client-side guard)
 *
 * This hook does NOT sign out users — that caused a redirect loop
 * where the hook would fight the modal during login.
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UseAuthResult {
  admin: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [admin, setAdmin]         = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAdmin(session?.user ?? null);
      setIsLoading(false);
    });

    // Keep in sync with Supabase auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdmin(session?.user ?? null);
      // Don't touch isLoading here — initial load already handled above
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAdmin(null);
    router.push('/');
  }, [router]);

  return { admin, isLoading, signOut };
}
