'use client';
/**
 * AuthModal — Admin-only authentication modal.
 * Authorized Personnel access only.
 * Validates admin role after every sign-in attempt.
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { ensureAdminProfile } from '../../lib/adminAuth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab: 'login' | 'signup';
}

type Screen = 'login' | 'signup' | 'confirm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid') || m.includes('credentials') || m.includes('wrong'))
    return 'Wrong email or password.';
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
    return 'This email is already registered. Sign in instead.';
  if (m.includes('database error saving new user'))
    return 'This email may already be registered. Try signing in instead, or use a different email.';
  if (m.includes('at least 6') || (m.includes('password') && m.includes('short')))
    return 'Password must be at least 6 characters.';
  if (m.includes('email') && m.includes('invalid'))
    return 'Please enter a valid email address.';
  if (m.includes('email not confirmed'))
    return 'Please confirm your email first, then sign in.';
  return msg;
}

function Spinner() {
  return (
    <span
      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0"
      aria-hidden="true"
    />
  );
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const inp = 'w-full bg-[#0d0d0d] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-red-500/50 transition-colors disabled:opacity-40';

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthModal({ isOpen, onClose, defaultTab }: Props) {
  const [screen, setScreen]       = useState<Screen>(defaultTab);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [showCpw, setShowCpw]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);
  const overlayRef                = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/tab changes
  useEffect(() => {
    if (!isOpen) return;
    setScreen(defaultTab);
    setError(null);
    setPassword('');
    setConfirmPw('');
  }, [defaultTab, isOpen]);

  function switchScreen(s: Screen) {
    setScreen(s);
    setError(null);
    setPassword('');
    setConfirmPw('');
  }

  function handleOverlay(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // ── Sign In ────────────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      // 1. Authenticate with Supabase
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;

      // 2. Get the authenticated user
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error('Authentication failed. Please try again.');

      // 3. Fetch profile — check role
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role, workspace_id')
        .eq('id', user.id)
        .maybeSingle();

      // Profile fetch error (e.g. table doesn't exist yet) — send to setup
      if (profileErr) {
        console.error('[Auth] Profile fetch error:', profileErr.message);
        onClose();
        window.location.href = '/dashboard/admin/setup';
        return;
      }

      // No profile row yet — new admin, create one and go to setup
      if (!profile) {
        await supabase.from('profiles').upsert(
          { id: user.id, role: 'admin', full_name: email.split('@')[0] },
          { onConflict: 'id', ignoreDuplicates: true }
        );
        onClose();
        window.location.href = '/dashboard/admin/setup';
        return;
      }

      // Profile exists but role is not admin
      if (profile.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Access denied. Authorized personnel only.');
      }

      // 4. Valid admin — redirect
      onClose();
      window.location.href = profile.workspace_id
        ? '/dashboard/admin'
        : '/dashboard/admin/setup';

    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : 'Sign in failed.'));
    } finally {
      setBusy(false);
    }
  }

  // ── Sign Up ────────────────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }

    setBusy(true);

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });

      // "Database error saving new user" = email already exists (unconfirmed or confirmed)
      // Try signing in directly instead
      if (signUpErr) {
        const msg = signUpErr.message.toLowerCase();
        if (msg.includes('database error saving new user') || msg.includes('already registered') || msg.includes('already exists')) {
          // Attempt sign-in with same credentials
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            // Wrong password for existing account
            throw new Error('This email is already registered. Check your password and use Sign In instead.');
          }
          // Sign-in worked — treat as login
          const user = signInData.user;
          if (!user) throw new Error('Authentication failed.');

          const { data: profile } = await supabase
            .from('profiles')
            .select('role, workspace_id')
            .eq('id', user.id)
            .maybeSingle();

          if (!profile) {
            await supabase.from('profiles').upsert(
              { id: user.id, role: 'admin', full_name: email.split('@')[0] },
              { onConflict: 'id', ignoreDuplicates: true }
            );
            onClose();
            window.location.href = '/dashboard/admin/setup';
            return;
          }

          onClose();
          window.location.href = profile.workspace_id ? '/dashboard/admin' : '/dashboard/admin/setup';
          return;
        }
        throw signUpErr;
      }

      if (!data.user) throw new Error('Account creation failed.');

      // No session = email confirmation required
      if (!data.session) {
        setScreen('confirm');
        return;
      }

      // Session exists — create admin profile and go to setup
      await ensureAdminProfile(data.user.id, email);
      onClose();
      window.location.href = '/dashboard/admin/setup';

    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : 'Registration failed.'));
    } finally {
      setBusy(false);
    }
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────
  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthErr) throw oauthErr;
      // Redirect handled by /auth/callback
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed.');
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Admin authentication"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      style={{ animation: 'am-fade 0.15s ease-out' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(6,6,6,0.97)',
          border: '1px solid rgba(255,255,255,0.07)',
          animation: 'am-scale 0.2s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '0 0 60px rgba(255,59,47,0.1), 0 40px 80px rgba(0,0,0,0.9)',
        }}
      >
        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 py-3 border-b border-white/5"
          style={{ background: 'rgba(255,59,47,0.06)' }}>
          <span className="text-xs text-red-400 font-semibold tracking-widest uppercase">
            🔒 Authorized Personnel Only
          </span>
        </div>

        {/* Tab bar */}
        {screen !== 'confirm' && (
          <div className="flex border-b border-white/5">
            {(['login', 'signup'] as const).map((s) => (
              <button
                key={s}
                onClick={() => switchScreen(s)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  screen === s
                    ? 'text-white border-b-2 border-red-500'
                    : 'text-[#444] hover:text-[#888]'
                }`}
              >
                {s === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>
        )}

        <div className="p-6">

          {/* ── Email confirmation screen ── */}
          {screen === 'confirm' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 text-2xl">
                📧
              </div>
              <h2 className="text-white font-bold text-lg mb-2">Confirm your email</h2>
              <p className="text-[#555] text-sm mb-1">Verification link sent to</p>
              <p className="text-white font-semibold text-sm mb-5 break-all">{email}</p>
              <p className="text-[#444] text-xs mb-6 leading-relaxed">
                Click the link in the email to activate your admin account, then sign in.
              </p>
              <button
                onClick={() => switchScreen('login')}
                className="w-full py-2.5 rounded-xl border border-white/8 text-white text-sm font-medium transition-colors hover:bg-white/5"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* ── Sign In ── */}
          {screen === 'login' && (
            <form onSubmit={handleSignIn} className="space-y-4" noValidate>
              <div className="mb-1">
                <p className="text-white font-bold text-lg">Admin Sign In</p>
                <p className="text-[#444] text-xs mt-0.5">FireRoute Control System</p>
              </div>

              <input
                type="email"
                placeholder="Admin email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={busy}
                className={inp}
              />

              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={busy}
                  className={inp}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] text-xs"
                  tabIndex={-1}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-900/50">
                  <span className="text-red-400 text-xs shrink-0 mt-0.5">⚠</span>
                  <p className="text-red-400 text-xs leading-relaxed">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #ff3b2f, #ff6a3d)',
                  boxShadow: busy ? 'none' : '0 0 28px rgba(255,59,47,0.35)',
                }}
              >
                {busy ? <><Spinner /> Verifying...</> : 'Sign In →'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-[#333]">or</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full py-3 rounded-xl border border-white/7 bg-white/3 hover:bg-white/6 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <GoogleIcon /> Continue with Google
              </button>

              <p className="text-center text-xs text-[#333]">
                New admin?{' '}
                <button
                  type="button"
                  onClick={() => switchScreen('signup')}
                  className="text-red-500 hover:text-red-400 transition-colors"
                >
                  Register here
                </button>
              </p>
            </form>
          )}

          {/* ── Register ── */}
          {screen === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4" noValidate>
              <div className="mb-1">
                <p className="text-white font-bold text-lg">Admin Registration</p>
                <p className="text-[#444] text-xs mt-0.5">Create your FireRoute admin account</p>
              </div>

              <input
                type="email"
                placeholder="Admin email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={busy}
                className={inp}
              />

              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={busy}
                  className={inp}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] text-xs"
                  tabIndex={-1}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showCpw ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={busy}
                  className={inp}
                />
                <button
                  type="button"
                  onClick={() => setShowCpw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] text-xs"
                  tabIndex={-1}
                >
                  {showCpw ? 'Hide' : 'Show'}
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-900/50">
                  <span className="text-red-400 text-xs shrink-0 mt-0.5">⚠</span>
                  <p className="text-red-400 text-xs leading-relaxed">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #ff3b2f, #ff6a3d)',
                  boxShadow: busy ? 'none' : '0 0 28px rgba(255,59,47,0.35)',
                }}
              >
                {busy ? <><Spinner /> Creating account...</> : 'Create Admin Account →'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-[#333]">or</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full py-3 rounded-xl border border-white/7 bg-white/3 hover:bg-white/6 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <GoogleIcon /> Continue with Google
              </button>

              <p className="text-center text-xs text-[#333]">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => switchScreen('login')}
                  className="text-red-500 hover:text-red-400 transition-colors"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

        </div>
      </div>

      <style>{`
        @keyframes am-fade  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes am-scale { from { opacity: 0; transform: scale(0.94) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
    </div>
  );
}
