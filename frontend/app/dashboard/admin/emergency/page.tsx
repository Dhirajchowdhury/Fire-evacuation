'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';
import type { ZoneStatus, EmergencyContact } from '../../../../../shared/types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const ZONES = ['A', 'B', 'C', 'D'] as const;
type ContactType = 'fire' | 'ambulance' | 'police' | 'manager' | 'other';

export default function EmergencyPage() {
  const { workspaceId, profile } = useAdminWorkspace();
  const [zones, setZones]         = useState<ZoneStatus[]>([]);
  const [contacts, setContacts]   = useState<EmergencyContact[]>([]);
  const [loading, setLoading]     = useState(true);
  const [zoneLoading, setZoneLoading] = useState<Record<string, boolean>>({});
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [allClearing, setAllClearing]   = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  // Contact form
  const [cName, setCName]   = useState('');
  const [cRole, setCRole]   = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cType, setCType]   = useState<ContactType>('fire');
  const [savingContact, setSavingContact] = useState(false);

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); }

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      supabase.from('zones').select('*').order('zone_id'),
      supabase.from('emergency_contacts').select('*').eq('workspace_id', workspaceId),
    ]).then(([zonesRes, contactsRes]) => {
      setZones((zonesRes.data ?? []) as ZoneStatus[]);
      setContacts((contactsRes.data ?? []) as EmergencyContact[]);
      setLoading(false);
    });

    const ch = supabase.channel('emergency-zones')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'zones' }, (p) => {
        setZones((prev) => prev.map((z) => z.zone_id === (p.new as ZoneStatus).zone_id ? p.new as ZoneStatus : z));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);

  async function triggerZone(zone: string, status: 'fire' | 'safe') {
    setZoneLoading((prev) => ({ ...prev, [`${zone}-${status}`]: true }));
    try {
      const res = await fetch(`${BACKEND}/api/fire-alert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone, status, device_id: 'admin-manual' }),
      });
      if (!res.ok) throw new Error('Request failed');
      showToast(`Zone ${zone} → ${status.toUpperCase()}`);
    } catch { showToast('Failed to update zone', false); }
    finally { setZoneLoading((prev) => ({ ...prev, [`${zone}-${status}`]: false })); }
  }

  async function broadcastEmergency() {
    if (!workspaceId || !profile || !broadcastMsg.trim()) return;
    setBroadcasting(true);
    await supabase.from('announcements').insert({
      workspace_id: workspaceId, admin_id: profile.id,
      title: '🚨 EMERGENCY ALERT', message: broadcastMsg.trim(), type: 'emergency',
    });
    setBroadcastMsg(''); setBroadcasting(false);
    showToast('Emergency broadcast sent to all users.');
  }

  async function broadcastAllClear() {
    if (!workspaceId || !profile) return;
    setAllClearing(true);
    await Promise.all([
      ...ZONES.map((z) => fetch(`${BACKEND}/api/fire-alert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: z, status: 'safe', device_id: 'admin-all-clear' }),
      })),
      supabase.from('announcements').insert({
        workspace_id: workspaceId, admin_id: profile.id,
        title: '✅ ALL CLEAR',
        message: 'ALL CLEAR — Building is safe. You may return to your workspace.',
        type: 'general',
      }),
    ]);
    setAllClearing(false);
    showToast('All clear broadcast sent. All zones cleared.');
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setSavingContact(true);
    const { data, error } = await supabase.from('emergency_contacts')
      .insert({ workspace_id: workspaceId, name: cName, role: cRole, phone: cPhone, type: cType })
      .select().single();
    if (!error && data) { setContacts((prev) => [...prev, data as EmergencyContact]); setCName(''); setCRole(''); setCPhone(''); }
    setSavingContact(false);
    showToast(error ? 'Failed to save contact.' : 'Contact added.');
  }

  if (loading) return <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />;

  const inputClass = 'bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500';

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Emergency Control</h1>

      {/* Warning banner */}
      <div className="bg-red-950 border border-red-500 rounded-xl px-5 py-4 flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <p className="text-red-300 font-semibold">Emergency controls affect all users in real-time. Use with caution.</p>
      </div>

      {/* Section 1 — Zone control */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-5">Manual Zone Control</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ZONES.map((z) => {
            const zone = zones.find((zs) => zs.zone_id === z);
            const isFire = zone?.status === 'fire';
            return (
              <div key={z} className={`rounded-xl border p-4 text-center space-y-3 ${
                isFire ? 'border-red-700 bg-red-950/40' : 'border-slate-700 bg-slate-900/40'
              }`}>
                <p className="text-white font-bold">Zone {z}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isFire ? 'bg-red-500 text-white' : 'bg-green-500/20 text-green-400 border border-green-500/40'
                }`}>{isFire ? '🔥 FIRE' : '🟢 SAFE'}</span>
                <div className="flex flex-col gap-2">
                  <button disabled={!!zoneLoading[`${z}-fire`]} onClick={() => triggerZone(z, 'fire')}
                    className="py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors">
                    {zoneLoading[`${z}-fire`] ? '...' : '🔥 Trigger Fire'}
                  </button>
                  <button disabled={!!zoneLoading[`${z}-safe`]} onClick={() => triggerZone(z, 'safe')}
                    className="py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors">
                    {zoneLoading[`${z}-safe`] ? '...' : '✅ Clear Zone'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2 — Broadcast */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">Broadcast Emergency Message</h2>
        <textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)}
          placeholder="Type emergency message..." rows={3}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none mb-3" />
        <button onClick={broadcastEmergency} disabled={broadcasting || !broadcastMsg.trim()}
          className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm rounded-lg disabled:opacity-50 transition-colors">
          {broadcasting ? 'Broadcasting...' : '📢 Broadcast to All Users'}
        </button>
      </div>

      {/* Section 3 — All clear */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center">
        <h2 className="text-white font-bold text-lg mb-4">All Clear</h2>
        <p className="text-slate-400 text-sm mb-5">Clears all fire zones and notifies all users that the building is safe.</p>
        <button onClick={broadcastAllClear} disabled={allClearing}
          className="px-10 py-4 bg-green-600 hover:bg-green-500 text-white font-black text-lg rounded-2xl disabled:opacity-50 transition-colors shadow-lg shadow-green-900/30">
          {allClearing ? 'Clearing...' : '✅ BROADCAST ALL CLEAR'}
        </button>
      </div>

      {/* Section 4 — Emergency contacts */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5">
        <h2 className="text-white font-bold text-lg">Emergency Contacts</h2>

        {/* Quick dial */}
        <div className="flex gap-3 flex-wrap">
          {[['🚒', 'Fire', '101'], ['🚑', 'Ambulance', '102'], ['🚔', 'Police', '100']].map(([icon, label, num]) => (
            <a key={label} href={`tel:${num}`}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-600 hover:border-red-500 rounded-xl text-sm text-white transition-colors">
              <span>{icon}</span><span>{label}: {num}</span>
            </a>
          ))}
        </div>

        {/* Contact list */}
        {contacts.length > 0 && (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-semibold">{c.name} <span className="text-slate-400 font-normal">· {c.role}</span></p>
                  <p className="text-slate-400 text-xs">{c.phone} · {c.type}</p>
                </div>
                <a href={`tel:${c.phone}`} className="text-green-400 hover:text-green-300 text-xs border border-green-800 px-2 py-1 rounded transition-colors">
                  Call
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Add contact form */}
        <form onSubmit={addContact} className="grid grid-cols-2 gap-3">
          <input value={cName} onChange={(e) => setCName(e.target.value)} required placeholder="Name" className={inputClass} />
          <input value={cRole} onChange={(e) => setCRole(e.target.value)} placeholder="Role" className={inputClass} />
          <input value={cPhone} onChange={(e) => setCPhone(e.target.value)} required placeholder="Phone" type="tel" className={inputClass} />
          <select value={cType} onChange={(e) => setCType(e.target.value as ContactType)}
            className={inputClass}>
            {(['fire', 'ambulance', 'police', 'manager', 'other'] as ContactType[]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button type="submit" disabled={savingContact}
            className="col-span-2 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
            {savingContact ? 'Saving...' : '+ Add Contact'}
          </button>
        </form>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 ${
          toast.ok ? 'bg-green-700' : 'bg-red-700'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}
