'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Flame, AlertCircle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

export default function WorkspaceSetupPage() {
  const router = useRouter();
  const [orgName, setOrgName]   = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) { setError('Organization name is required'); return; }
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error('Session expired. Please sign in again.');

      // Check if workspace already exists for this admin (avoid duplicate on retry)
      const { data: existing } = await supabase
        .from('workspaces')
        .select('id')
        .eq('admin_id', user.id)
        .maybeSingle();

      let workspaceId: string;

      if (existing?.id) {
        // Already created — just update profile and continue
        workspaceId = existing.id;
      } else {
        // Generate unique invite link — retry on collision
        let inviteLink = `fireroute-${nanoid(10)}`;
        let workspace = null;
        let wsErr = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await supabase
            .from('workspaces')
            .insert({
              name: orgName.trim(),
              location: location.trim() || null,
              admin_id: user.id,
              invite_link: inviteLink,
              qr_code: inviteLink,
            })
            .select('id')
            .single();

          if (!res.error) { workspace = res.data; wsErr = null; break; }
          // If unique violation on invite_link, retry with new code
          if (res.error.code === '23505') {
            inviteLink = `fireroute-${nanoid(12)}`;
            wsErr = res.error;
          } else {
            wsErr = res.error;
            break;
          }
        }

        if (wsErr || !workspace) {
          throw new Error(wsErr?.message ?? 'Failed to create workspace');
        }
        workspaceId = workspace.id;
      }

      // Upsert profile — works whether profile exists or not
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            full_name: user.user_metadata?.full_name
              ?? user.user_metadata?.name
              ?? user.email?.split('@')[0]
              ?? 'Admin',
            phone: null,
            role: 'admin',
            workspace_id: workspaceId,
          },
          { onConflict: 'id' }
        );

      if (profErr) throw new Error(profErr.message);

      // Hard navigate so layout re-fetches fresh workspace data
      window.location.href = '/dashboard/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-xl">FireRoute</span>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8">
          <div className="mb-6">
            <h1 className="text-white font-bold text-2xl">Set up your workspace</h1>
            <p className="text-slate-400 text-sm mt-1">
              One-time setup. Tell us about your organization.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1.5">
                Organization Name *
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. City Hospital, Acme Corp"
                required
                autoFocus
                disabled={loading}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1.5">
                Location <span className="normal-case text-slate-600">(optional)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Kolkata, India"
                disabled={loading}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating workspace...
                </>
              ) : (
                'Create Workspace & Continue →'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          You can update these settings anytime in your dashboard.
        </p>
      </div>
    </div>
  );
}
