/**
 * adminAuth.ts — Central admin validation utility
 * Used by useAuth hook, AuthModal, middleware, and auth callback.
 * Single source of truth for admin access control.
 */
import { supabase } from './supabase';

export interface AdminProfile {
  id: string;
  role: string;
  workspace_id: string | null;
  full_name: string | null;
}

export type AdminValidationResult =
  | { valid: true;  profile: AdminProfile }
  | { valid: false; reason: 'no_session' | 'no_profile' | 'not_admin' | 'error' };

/**
 * Validates that the currently authenticated user is an admin.
 * Fetches profile and checks role === 'admin'.
 * Returns a typed result — never throws.
 */
export async function validateAdmin(userId: string): Promise<AdminValidationResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, workspace_id, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) return { valid: false, reason: 'error' };
    if (!data)  return { valid: false, reason: 'no_profile' };
    if (data.role !== 'admin') return { valid: false, reason: 'not_admin' };

    return { valid: true, profile: data as AdminProfile };
  } catch {
    return { valid: false, reason: 'error' };
  }
}

/**
 * Ensures a profile row exists for a newly signed-up admin.
 * Safe to call multiple times — uses upsert with ON CONFLICT DO NOTHING.
 */
export async function ensureAdminProfile(userId: string, email?: string): Promise<void> {
  await supabase.from('profiles').upsert(
    {
      id: userId,
      role: 'admin',
      full_name: email?.split('@')[0] ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
}
