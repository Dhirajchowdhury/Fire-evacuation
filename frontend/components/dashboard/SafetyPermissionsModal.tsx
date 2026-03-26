'use client';
/**
 * SafetyPermissionsModal — shown once after first login.
 * Requests camera, notifications, and location permissions.
 * Status stored in localStorage so it only shows once.
 */
import { useState } from 'react';

const STORAGE_KEY = 'fireroute_permissions_asked';

export function shouldShowPermissions(): boolean {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(STORAGE_KEY);
}

interface PermState {
  camera:        'idle' | 'granted' | 'denied' | 'loading';
  notifications: 'idle' | 'granted' | 'denied' | 'loading';
  location:      'idle' | 'granted' | 'denied' | 'loading';
}

interface Props {
  onDone: () => void;
}

export default function SafetyPermissionsModal({ onDone }: Props) {
  const [perms, setPerms] = useState<PermState>({
    camera: 'idle', notifications: 'idle', location: 'idle',
  });
  const [allBusy, setAllBusy] = useState(false);

  function set(key: keyof PermState, val: PermState[keyof PermState]) {
    setPerms(p => ({ ...p, [key]: val }));
  }

  async function requestCamera() {
    set('camera', 'loading');
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      set('camera', 'granted');
    } catch {
      set('camera', 'denied');
    }
  }

  async function requestNotifications() {
    set('notifications', 'loading');
    try {
      const result = await Notification.requestPermission();
      set('notifications', result === 'granted' ? 'granted' : 'denied');
    } catch {
      set('notifications', 'denied');
    }
  }

  async function requestLocation() {
    set('location', 'loading');
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => { set('location', 'granted'); resolve(); },
        () => { set('location', 'denied');  resolve(); }
      );
    });
  }

  async function handleAllowAll() {
    setAllBusy(true);
    await Promise.allSettled([requestCamera(), requestNotifications(), requestLocation()]);
    setAllBusy(false);
  }

  function handleDone() {
    localStorage.setItem(STORAGE_KEY, '1');
    onDone();
  }

  const icon = (s: PermState[keyof PermState]) => {
    if (s === 'loading') return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />;
    if (s === 'granted') return <span className="text-green-400">✓</span>;
    if (s === 'denied')  return <span className="text-red-400">✗</span>;
    return <span className="text-slate-600">○</span>;
  };

  const ITEMS = [
    {
      key: 'camera' as const,
      emoji: '📷',
      title: 'Camera',
      desc: 'Required for AR evacuation overlay — shows live exit routes through your camera.',
      action: requestCamera,
    },
    {
      key: 'notifications' as const,
      emoji: '🔔',
      title: 'Notifications',
      desc: 'Receive instant fire alerts and SOS signals even when the tab is in the background.',
      action: requestNotifications,
    },
    {
      key: 'location' as const,
      emoji: '📍',
      title: 'Location',
      desc: 'Helps pinpoint your position in the building for accurate evacuation routing.',
      action: requestLocation,
    },
  ];

  const allGranted = Object.values(perms).every(v => v === 'granted' || v === 'denied');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(6,6,6,0.97)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 0 60px rgba(255,59,47,0.1), 0 40px 80px rgba(0,0,0,0.9)',
        }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mb-4">
            🛡️
          </div>
          <h2 className="text-white font-bold text-xl">Enable Safety Features</h2>
          <p className="text-[#555] text-sm mt-1 leading-relaxed">
            FireRoute needs these permissions to protect your building effectively.
          </p>
        </div>

        {/* Permission items */}
        <div className="px-6 py-4 space-y-3">
          {ITEMS.map(({ key, emoji, title, desc, action }) => (
            <div key={key} className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-sm font-semibold">{title}</p>
                  <span className="text-sm shrink-0">{icon(perms[key])}</span>
                </div>
                <p className="text-[#555] text-xs mt-0.5 leading-relaxed">{desc}</p>
              </div>
              {perms[key] === 'idle' && (
                <button onClick={action}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-[#888] hover:text-white hover:border-white/20 transition-colors">
                  Allow
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          {!allGranted && (
            <button onClick={handleAllowAll} disabled={allBusy}
              className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #ff3b2f, #ff6a3d)', boxShadow: '0 0 24px rgba(255,59,47,0.3)' }}>
              {allBusy
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Requesting...</>
                : '🔓 Allow All'}
            </button>
          )}
          <button onClick={handleDone}
            className="w-full py-2.5 rounded-xl border border-white/8 text-[#666] hover:text-white text-sm font-medium transition-colors">
            {allGranted ? 'Continue to Dashboard →' : 'Skip for now'}
          </button>
        </div>
      </div>
    </div>
  );
}
