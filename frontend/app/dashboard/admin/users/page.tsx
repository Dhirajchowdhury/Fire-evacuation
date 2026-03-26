'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { Profile } from '../../../../../shared/types';

export default function UsersPage() {
  const { workspaceId } = useAdminWorkspace();
  const [users, setUsers]     = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [toast, setToast]     = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from('profiles').select('*').eq('workspace_id', workspaceId)
      .then(({ data }) => { setUsers((data ?? []) as Profile[]); setLoading(false); });
  }, [workspaceId]);

  async function handleRemove(id: string) {
    await supabase.from('profiles').update({ workspace_id: null }).eq('id', id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setConfirmRemove(null); showToast('User removed from workspace.');
  }

  function exportCSV() {
    const rows = [['Name', 'Phone', 'Role', 'Joined'], ...users.map((u) => [u.full_name, u.phone, u.role, u.created_at])];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click();
  }

  const filtered = users.filter((u) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );

  const thisWeek = users.filter((u) => {
    const d = new Date(u.created_at);
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  }).length;

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <button onClick={exportCSV}
          className="px-4 py-2 border border-slate-600 text-slate-300 hover:text-white text-sm rounded-lg transition-colors">
          Export CSV
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 text-sm">
        <span className="text-slate-400">Total: <span className="text-white font-bold">{users.length}</span></span>
        <span className="text-slate-400">Joined this week: <span className="text-white font-bold">{thisWeek}</span></span>
      </div>

      {/* Search */}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone..."
        className="w-full max-w-sm bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500" />

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
              {['Name', 'Phone', 'Role', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No users found.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-white">{u.full_name || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{u.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'admin' ? 'bg-red-950 text-red-300' : 'bg-slate-700 text-slate-300'
                  }`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setConfirmRemove(u.id)}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-2 py-1 rounded transition-colors">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-center">
            <p className="text-white font-semibold mb-2">Remove this user?</p>
            <p className="text-slate-400 text-sm mb-5">They will lose access to this workspace.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemove(null)}
                className="flex-1 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={() => handleRemove(confirmRemove)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
