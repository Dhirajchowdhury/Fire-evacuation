'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Flame, Menu, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { WorkspaceProvider } from './WorkspaceContext';
import { useWorkspaceCtx } from './WorkspaceContext';
import SafetyPermissionsModal, { shouldShowPermissions } from '../../../components/dashboard/SafetyPermissionsModal';

const NAV = [
  { icon: '📊', label: 'Overview',      href: '/dashboard/admin' },
  { icon: '🗺️', label: 'Floor Plan',    href: '/dashboard/admin/floorplan' },
  { icon: '📡', label: 'Sensors',       href: '/dashboard/admin/sensors' },
  { icon: '💚', label: 'Sensor Health', href: '/dashboard/admin/health' },
  { icon: '👥', label: 'Users',         href: '/dashboard/admin/users' },
  { icon: '🌡️', label: 'Occupancy',    href: '/dashboard/admin/occupancy' },
  { icon: '🔗', label: 'QR Code',       href: '/dashboard/admin/qrcode' },
  { icon: '📢', label: 'Announcements', href: '/dashboard/admin/announcements' },
  { icon: '🚨', label: 'Live Alerts',   href: '/dashboard/admin/alerts' },
  { icon: '🧪', label: 'Drill Mode',    href: '/dashboard/admin/drills' },
  { icon: '📊', label: 'Analytics',     href: '/dashboard/admin/analytics' },
  { icon: '📁', label: 'Past Records',  href: '/dashboard/admin/records' },
  { icon: '🆘', label: 'Emergency',     href: '/dashboard/admin/emergency' },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { workspace } = useWorkspaceCtx();
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800">
        <Flame className="text-red-500 w-5 h-5 shrink-0" />
        <span className="text-white font-bold text-lg">FireRoute</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Workspace name */}
      <div className="px-5 py-3 border-b border-slate-800">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Workspace</p>
        <p className="text-slate-200 text-sm font-medium mt-0.5 truncate">
          {workspace?.name ?? '—'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map(({ icon, label, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-all ${
                active
                  ? 'bg-red-950/50 border-l-2 border-red-500 text-white font-medium pl-2.5'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {email[0]?.toUpperCase() ?? 'A'}
          </div>
          <p className="text-xs text-slate-400 truncate">{email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg py-1.5 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPerms, setShowPerms]   = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/'); return; }
      const { data } = await supabase
        .from('profiles')
        .select('role, workspace_id')
        .eq('id', user.id)
        .maybeSingle();
      if (!data || data.role !== 'admin') { router.replace('/'); return; }
      if (!data.workspace_id) { router.replace('/dashboard/admin/setup'); return; }
      // Show permissions modal once after login
      if (shouldShowPermissions()) setShowPerms(true);
    });
  }, [router]);

  return (
    <WorkspaceProvider>
      {showPerms && <SafetyPermissionsModal onDone={() => setShowPerms(false)} />}
      <div className="flex h-screen bg-[#0f172a] overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex w-64 shrink-0 flex-col">
          <SidebarContent />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="w-64 shrink-0">
              <SidebarContent onClose={() => setMobileOpen(false)} />
            </div>
            <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile topbar */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
            <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white">
              <Menu className="w-5 h-5" />
            </button>
            <Flame className="text-red-500 w-4 h-4" />
            <span className="text-white font-bold">FireRoute Admin</span>
          </div>

          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
