'use client';
/**
 * useAdminWorkspace — thin wrapper that reads from WorkspaceContext.
 * The context is provided by AdminLayout, so data is fetched ONCE per
 * layout mount and shared across all admin pages — no per-page re-fetches.
 */
import { useWorkspaceCtx } from '../app/dashboard/admin/WorkspaceContext';

export function useAdminWorkspace() {
  return useWorkspaceCtx();
}
