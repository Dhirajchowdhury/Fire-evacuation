'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { Announcement } from '../../../../../shared/types';

const TYPES = ['general', 'emergency', 'maintenance', 'drill'] as const;
type AnnType = typeof TYPES[number];

const TYPE_COLORS: Record<AnnType, string> = {
  general:     'bg-slate-700 text-slate-300',
  emergency:   'bg-red-950 text-red-300',
  maintenance: 'bg-yellow-950 text-yellow-300',
  drill:       'bg-blue-950 text-blue-300',
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AnnouncementsPage() {
  const { workspaceId, profile } = useAdminWorkspace();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading]   = useState(true);
  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [type, setType]         = useState<AnnType>('general');
  const [sending, setSending]   = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from('announcements').select('*').eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setAnnouncements((data ?? []) as Announcement[]); setLoading(false); });

    const ch = supabase.channel('announcements-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (p) => {
        setAnnouncements((prev) => [p.new as Announcement, ...prev]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, (p) => {
        setAnnouncements((prev) => prev.filter((a) => a.id !== (p.old as Announcement).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !profile) return;
    setSending(true);
    const { error } = await supabase.from('announcements').insert({
      workspace_id: workspaceId, admin_id: profile.id, title, message, type,
    });
    if (!error) { setTitle(''); setMessage(''); showToast('Announcement broadcast!'); }
    else showToast('Failed: ' + error.message);
    setSending(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('announcements').delete().eq('id', id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Announcements</h1>

      {/* Create form */}
      <form onSubmit={handleBroadcast} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <p className="text-white font-semibold">New Announcement</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Title"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required placeholder="Message" rows={3}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none" />
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                type === t ? 'border-red-500 bg-red-950/40 text-red-300' : 'border-slate-600 text-slate-400 hover:border-slate-400'
              }`}>{t}</button>
          ))}
        </div>
        <button type="submit" disabled={sending}
          className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
          {sending ? 'Broadcasting...' : '📢 Broadcast Now'}
        </button>
      </form>

      {/* List */}
      {loading ? <div className="h-32 bg-slate-800 animate-pulse rounded-xl" /> : (
        <div className="space-y-3">
          {announcements.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">No announcements yet.</p>
          )}
          {announcements.map((a) => (
            <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white font-semibold text-sm">{a.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[a.type as AnnType] ?? TYPE_COLORS.general}`}>
                    {a.type}
                  </span>
                </div>
                <p className="text-slate-400 text-sm line-clamp-2">{a.message}</p>
                <p className="text-slate-500 text-xs mt-1">{timeAgo(a.created_at)}</p>
              </div>
              <button onClick={() => handleDelete(a.id)}
                className="text-slate-500 hover:text-red-400 text-xs shrink-0 transition-colors">✕</button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
