'use client';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Profile, Workspace } from '../../../../shared/types';

interface WorkspaceCtx {
  profile: Profile | null;
  workspace: Workspace | null;
  workspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const Ctx = createContext<WorkspaceCtx>({
  profile: null, workspace: null, workspaceId: null,
  isLoading: true, error: null, reload: () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profErr) throw profErr;
      setProfile(prof as Profile);

      if (prof.workspace_id) {
        const { data: ws, error: wsErr } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', prof.workspace_id)
          .single();
        if (!wsErr) setWorkspace(ws as Workspace);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Ctx.Provider value={{
      profile, workspace,
      workspaceId: workspace?.id ?? null,
      isLoading, error,
      reload: load,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspaceCtx() { return useContext(Ctx); }
