'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Flame, Menu, X, ArrowRight, Zap, Shield, Cpu, Wifi, Navigation } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AuthModal from '../components/auth/AuthModal';
import MagneticButton from '../components/landing/MagneticButton';
import SmoothScrollProvider from '../components/landing/SmoothScrollProvider';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useCounter } from '../hooks/useCounter';

const HeroCanvas = dynamic(() => import('../components/landing/HeroCanvas'), { ssr: false });

// ─── Cursor glow ─────────────────────────────────────────────────────────────
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(hover: none)').matches) return;
    function onMove(e: MouseEvent) {
      el!.style.left = e.clientX + 'px';
      el!.style.top  = e.clientY + 'px';
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  return <div ref={ref} className="cursor-glow" aria-hidden="true" />;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Home',      href: '#' },
  { label: 'Services',  href: '#solution' },
  { label: 'Works',     href: '#how-it-works' },
  { label: 'About',     href: '#use-cases' },
  { label: 'Contact',   href: '#contact' },
];

interface NavbarProps {
  user: ReturnType<typeof useAuth>['admin'];
  onLogin: () => void;
  onSignup: () => void;
  onSignOut: () => void;
}

function Navbar({ user, onLogin, onSignup, onSignOut }: NavbarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 30); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'nav-scrolled' : ''}`}
      style={{
        background: scrolled ? undefined : 'transparent',
        backdropFilter: scrolled ? undefined : 'none',
        borderBottom: scrolled ? undefined : '1px solid transparent',
      }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">FireRoute</span>
        </div>

        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href}
              className="text-[#666] hover:text-white text-sm font-medium transition-colors duration-200">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <button onClick={() => router.push('/dashboard/admin')}
                className="btn-shine btn-primary px-5 py-2 rounded-full text-white text-sm font-semibold">
                Dashboard →
              </button>
              <button onClick={onSignOut} className="text-[#555] hover:text-white text-sm transition-colors">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button onClick={onLogin} className="text-[#666] hover:text-white text-sm font-medium transition-colors px-3 py-2">
                Sign In
              </button>
              <MagneticButton onClick={onSignup} strength={6}
                className="btn-shine btn-primary px-5 py-2 rounded-full text-white text-sm font-semibold cursor-pointer">
                Get Started
              </MagneticButton>
            </>
          )}
        </div>

        <button className="md:hidden text-[#666] hover:text-white transition-colors p-1"
          onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <div className="md:hidden overflow-hidden transition-all duration-300"
        style={{ maxHeight: mobileOpen ? '320px' : '0', opacity: mobileOpen ? 1 : 0 }}>
        <div className="bg-black/95 border-t border-white/5 px-6 py-5 flex flex-col gap-4">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
              className="text-[#666] hover:text-white text-sm font-medium transition-colors">{l.label}</a>
          ))}
          <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
            {user ? (
              <>
                <button onClick={() => { router.push('/dashboard/admin'); setMobileOpen(false); }}
                  className="px-4 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold">
                  Dashboard →
                </button>
                <button onClick={onSignOut} className="text-[#555] text-sm text-left">Sign Out</button>
              </>
            ) : (
              <>
                <button onClick={() => { onLogin(); setMobileOpen(false); }}
                  className="text-[#666] text-sm text-left">Sign In</button>
                <button onClick={() => { onSignup(); setMobileOpen(false); }}
                  className="px-4 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold">
                  Get Started Free
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
interface HeroProps {
  user: ReturnType<typeof useAuth>['admin'];
  onSignup: () => void;
}

function Hero({ user, onSignup }: HeroProps) {
  const router = useRouter();
  const glowRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const current = useRef({ x: 0.5, y: 0.5 });
  const rafId = useRef<number>(0);

  // Cursor-tracking glow with lerp
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    function onMove(e: MouseEvent) {
      mouse.current.x = e.clientX / window.innerWidth;
      mouse.current.y = e.clientY / window.innerHeight;
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    function tick() {
      current.current.x += (mouse.current.x - current.current.x) * 0.06;
      current.current.y += (mouse.current.y - current.current.y) * 0.06;
      if (glowRef.current) {
        glowRef.current.style.background =
          `radial-gradient(600px circle at ${current.current.x * 100}% ${current.current.y * 100}%, rgba(255,59,47,0.12) 0%, transparent 70%)`;
      }
      rafId.current = requestAnimationFrame(tick);
    }
    rafId.current = requestAnimationFrame(tick);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(rafId.current); };
  }, []);

  function handleCTA() {
    if (user) router.push('/dashboard/admin');
    else onSignup();
  }

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden vignette" style={{ background: 'var(--bg)' }}>
      {/* Three.js canvas background */}
      <HeroCanvas />

      {/* Deep radial glow behind orb */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1,
        background: 'radial-gradient(ellipse 55% 70% at 75% 50%, rgba(255,59,47,0.18) 0%, rgba(255,59,47,0.05) 45%, transparent 70%)' }} />

      {/* Cursor-tracking red glow */}
      <div ref={glowRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1,
        background: 'radial-gradient(600px circle at 50% 50%, rgba(255,59,47,0.12) 0%, transparent 70%)' }} />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none" style={{ zIndex: 2,
        background: 'linear-gradient(to bottom, transparent, var(--bg))' }} />

      <div className="relative w-full max-w-7xl mx-auto px-5 sm:px-8 pt-28 pb-20" style={{ zIndex: 10 }}>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — text */}
          <div>
            {/* Badge */}
            <div className="hero-badge inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-xs font-semibold text-red-300"
              style={{ background: 'rgba(255,59,47,0.08)', border: '1px solid rgba(255,59,47,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-dot" />
              IoT Fire Detection System — Live
            </div>

            <h1 className="hero-h1 font-black leading-[1.05] tracking-tight text-white"
              style={{ fontSize: 'clamp(2.8rem, 6vw, 5rem)' }}>
              Every Second<br />
              <span className="gradient-text">Counts.</span><br />
              <span className="text-white">Make Every</span><br />
              <span className="gradient-text">Exit Smarter.</span>
            </h1>

            <p className="hero-sub text-[#777] text-base sm:text-lg mt-6 leading-relaxed max-w-md">
              FireRoute transforms any building into an intelligent evacuation network.
              Real-time IoT sensors. Dynamic BFS routing. Life-saving decisions in under 2 seconds.
            </p>

            <div className="hero-btns flex flex-wrap gap-3 mt-8">
              <MagneticButton onClick={handleCTA} strength={8}
                className="btn-shine btn-secondary flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold cursor-pointer">
                See It Live
              </MagneticButton>
              <MagneticButton onClick={handleCTA} strength={8}
                className="btn-shine btn-primary flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-bold cursor-pointer">
                Get Started Free →
              </MagneticButton>
            </div>

            {/* Mini stats row */}
            <div className="hero-stats flex flex-wrap gap-8 mt-10 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { val: '<2s',  label: 'Reroute Speed' },
                { val: '24/7', label: 'Live Monitoring' },
                { val: '∞',    label: 'Zones Supported' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <p className="text-white font-black text-2xl">{val}</p>
                  <p className="text-[#444] text-xs mt-0.5 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — floating stat cards */}
          <div className="hidden lg:flex flex-col gap-4 items-end">
            <div className="hero-card-1 glass-card rounded-2xl p-5 w-52 animate-float-y" style={{ animationDelay: '0s' }}>
              <p className="text-[#444] text-xs mb-1 uppercase tracking-wider">Zones monitored</p>
              <p className="text-white font-black text-3xl">400+</p>
              <div className="flex gap-1 mt-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full"
                    style={{ background: `rgba(255,59,47,${0.2 + i * 0.18})` }} />
                ))}
              </div>
            </div>

            <div className="hero-card-2 glass-card rounded-2xl p-5 w-52 animate-float-y" style={{ animationDelay: '1.8s' }}>
              <p className="text-[#444] text-xs mb-1 uppercase tracking-wider">Buildings protected</p>
              <p className="text-white font-black text-3xl">230+</p>
              <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full w-4/5 rounded-full" style={{ background: 'linear-gradient(90deg, #ff3b2f, #ff6a3d)' }} />
              </div>
            </div>

            <div className="hero-card-3 glass-red rounded-2xl p-5 w-52 animate-float-y animate-border-glow" style={{ animationDelay: '0.9s' }}>
              <p className="text-red-400 text-xs font-semibold mb-1 uppercase tracking-wider">Avg reroute time</p>
              <p className="text-white font-black text-3xl">&lt;2s</p>
              <p className="text-[#444] text-xs mt-1">BFS pathfinding</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Marquee / Social Proof ───────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  '🏢 Corporate Offices', '🏥 Hospitals', '🏫 Schools', '✈️ Airports',
  '🏨 Hotels', '🏭 Factories', '🎓 Universities', '🛍️ Shopping Malls',
  '🏛️ Government Buildings', '🏗️ Warehouses',
];

function SocialProofBar() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="py-4 border-y border-white/5 overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="overflow-hidden">
        <div className="flex gap-10 animate-marquee whitespace-nowrap">
          {doubled.map((item, i) => (
            <span key={i} className="text-[#444] text-sm font-medium shrink-0">{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── About / Mission ──────────────────────────────────────────────────────────
function AboutSection() {
  const ref = useScrollReveal<HTMLElement>();
  return (
    <section ref={ref} className="py-24" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid md:grid-cols-2 gap-16 items-center">
        {/* Left — visual */}
        <div className="scroll-reveal relative rounded-3xl overflow-hidden aspect-[4/3]"
          style={{ transitionDelay: '0ms' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-[#1a0505] to-black" />
          {/* Animated building grid */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-48 h-48">
              {/* Zone grid */}
              {[
                { x: 0,   y: 0,   color: '#ef4444', label: 'A', fire: true },
                { x: 52,  y: 0,   color: '#22c55e', label: 'B', fire: false },
                { x: 0,   y: 52,  color: '#22c55e', label: 'C', fire: false },
                { x: 52,  y: 52,  color: '#22c55e', label: 'D', fire: false },
              ].map(({ x, y, color, label, fire }) => (
                <div key={label} className="absolute w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ left: x + 48, top: y + 48, background: `${color}22`, border: `1px solid ${color}55`,
                    boxShadow: fire ? `0 0 16px ${color}44` : 'none' }}>
                  {fire ? '🔥' : label}
                </div>
              ))}
              {/* Center glow */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center animate-glow-pulse">
                  <Flame className="w-7 h-7 text-red-500" />
                </div>
              </div>
            </div>
          </div>
          {/* Status badge */}
          <div className="absolute top-4 left-4 glass rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
              <p className="text-red-400 text-xs font-semibold">Fire detected — Zone A</p>
            </div>
            <p className="text-white text-sm font-bold mt-0.5">Rerouting via Zone C → Exit 2</p>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <button className="w-full py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">
              View Live Dashboard
            </button>
          </div>
        </div>

        {/* Right — text */}
        <div>
          <p className="scroll-reveal text-red-500 text-xs font-bold tracking-widest uppercase mb-4" style={{ transitionDelay: '60ms' }}>
            About FireRoute
          </p>
          <h2 className="scroll-reveal text-4xl sm:text-5xl font-black text-white leading-tight" style={{ transitionDelay: '120ms' }}>
            We <span className="text-red-500">detect</span> fire and{' '}
            <span className="text-red-500">reroute</span> occupants in real-time, ensuring
            every <span className="text-red-400">exit decision</span> saves lives.
          </h2>

          {/* Stat */}
          <div className="scroll-reveal mt-8 flex items-center gap-6" style={{ transitionDelay: '200ms' }}>
            <div>
              <p className="text-white font-black text-5xl">&lt;2s</p>
              <div className="flex gap-0.5 mt-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-red-500 text-sm">★</span>
                ))}
              </div>
            </div>
            <p className="text-[#555] text-sm max-w-[200px] leading-relaxed">
              Average time from fire detection to new evacuation route being pushed to all occupants.
            </p>
          </div>

          {/* Feature list */}
          <div className="scroll-reveal glass-card rounded-2xl p-5 mt-6 space-y-3" style={{ transitionDelay: '280ms' }}>
            {[
              { icon: '🔥', text: 'Real-time fire & smoke detection via ESP32 sensors' },
              { icon: '🗺️', text: 'BFS algorithm recalculates safest exit path instantly' },
              { icon: '📡', text: 'Live dashboard for admins — zone-by-zone visibility' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">{icon}</span>
                <p className="text-[#888] text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Solution / Services ──────────────────────────────────────────────────────
const SERVICES = [
  {
    tag: 'Detection',
    title: 'Real-Time\nFire Detection',
    body: 'ESP32 IoT sensors monitor every zone continuously. The moment smoke or heat is detected, the system triggers instantly — no manual intervention needed.',
    chips: ['ESP32 sensors', 'Smoke & heat detection', 'Zone-level precision'],
    icon: Flame,
    accent: '#ef4444',
  },
  {
    tag: 'Routing',
    title: 'Smart\nEvacuation Routing',
    body: 'BFS algorithm recalculates the safest exit path in real-time. Blocked zones are avoided automatically. Every occupant gets a clear, dynamic route.',
    chips: ['BFS pathfinding', 'Dynamic rerouting', 'Multi-floor support'],
    icon: Navigation,
    accent: '#f97316',
  },
  {
    tag: 'Dashboard',
    title: 'Admin\nControl Center',
    body: 'Full visibility across your building. Manage zones, trigger drills, broadcast alerts, and monitor sensor health — all from one live dashboard.',
    chips: ['Live zone map', 'Drill mode', 'Broadcast alerts'],
    icon: Shield,
    accent: '#ef4444',
  },
];

function SolutionSection() {
  const ref = useScrollReveal<HTMLElement>();
  return (
    <section ref={ref} id="solution" className="py-24" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid md:grid-cols-3 gap-5">
          {SERVICES.map(({ tag, title, body, chips, icon: Icon, accent }, i) => (
            <div key={tag}
              className="scroll-reveal card-glow glass-card rounded-2xl p-7 flex flex-col gap-5 cursor-default"
              style={{ transitionDelay: `${i * 100}ms`, borderColor: 'rgba(255,255,255,0.06)' }}>
              {/* Tag */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                <span className="text-xs font-semibold" style={{ color: accent }}>{tag}</span>
              </div>

              {/* Icon */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                <Icon className="w-5 h-5" style={{ color: accent }} />
              </div>

              {/* Title */}
              <h3 className="text-white font-black text-2xl leading-tight whitespace-pre-line">{title}</h3>

              {/* Body */}
              <p className="text-[#666] text-sm leading-relaxed flex-1">{body}</p>

              {/* Chips */}
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <span key={c} className="text-xs px-3 py-1 rounded-full border border-white/8 text-[#666]"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const STEPS = [
  { num: '01', icon: Cpu,        color: '#ef4444', title: 'Install Sensors',
    body: 'Place FireRoute IoT nodes in each zone. Takes minutes, not days. Plug-and-play ESP32 hardware.' },
  { num: '02', icon: Wifi,       color: '#f97316', title: 'Connect & Map',
    body: 'Sensors connect to FireRoute cloud instantly. Your building graph goes live. Zones appear on the dashboard.' },
  { num: '03', icon: Navigation, color: '#ef4444', title: 'Protect 24/7',
    body: 'FireRoute monitors continuously. The moment danger is detected, BFS calculates the safest path instantly.' },
];

function HowItWorks() {
  const ref = useScrollReveal<HTMLElement>();
  const lineRef = useRef<HTMLDivElement>(null);
  const [lineVisible, setLineVisible] = useState(false);

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setLineVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} id="how-it-works" className="py-24 border-t border-white/5" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16">
          <p className="scroll-reveal text-red-500 text-xs font-bold tracking-widest uppercase mb-3">Process</p>
          <h2 className="scroll-reveal text-4xl sm:text-5xl font-black text-white" style={{ transitionDelay: '80ms' }}>
            How It Works
          </h2>
        </div>

        <div ref={lineRef} className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line — desktop */}
          <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1200 ease-out"
              style={{ width: lineVisible ? '100%' : '0%', transitionDuration: '1.2s' }} />
          </div>

          {STEPS.map(({ num, icon: Icon, color, title, body }, i) => (
            <div key={num} className="scroll-reveal flex flex-col items-center text-center md:items-start md:text-left"
              style={{ transitionDelay: `${i * 150}ms` }}>
              {/* Number + icon */}
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10"
                  style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                  <Icon className="w-7 h-7" style={{ color }} />
                </div>
                <span className="absolute -top-3 -right-3 text-xs font-black text-white/20 select-none">{num}</span>
              </div>
              <h3 className="text-white font-bold text-xl mb-3">{title}</h3>
              <p className="text-[#666] text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
const STATS = [
  { numeric: null,  symbol: '∞',    label: 'Zones Supported',        prefix: '', suffix: '' },
  { numeric: 2,     symbol: null,   label: 'Seconds to Reroute',     prefix: '<', suffix: 's' },
  { numeric: 99,    symbol: null,   label: 'Uptime Guarantee',       prefix: '', suffix: '%' },
  { numeric: null,  symbol: '24/7', label: 'Live Monitoring',        prefix: '', suffix: '' },
];

function StatItem({ numeric, symbol, label, prefix = '', suffix = '', active }: {
  numeric: number | null; symbol: string | null; label: string;
  prefix?: string; suffix?: string; active: boolean;
}) {
  const count = useCounter(numeric ?? 0, active && numeric !== null, 1800,
    (n) => `${prefix}${Math.round(n)}${suffix}`);
  const display = symbol ?? (numeric !== null ? count : '');
  return (
    <div className="text-center px-6 py-8 border-r border-white/5 last:border-r-0">
      <div className="text-4xl sm:text-5xl font-black text-white mb-2">{display}</div>
      <p className="text-[#555] text-sm">{label}</p>
    </div>
  );
}

function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="border-y border-white/5" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {STATS.map(({ numeric, symbol, label, prefix, suffix }, i) => (
            <div key={label} className="transition-all duration-700"
              style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: `${i * 100}ms` }}>
              <StatItem numeric={numeric} symbol={symbol} label={label}
                prefix={prefix} suffix={suffix} active={visible} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Use Cases ────────────────────────────────────────────────────────────────
const USE_CASES = [
  { emoji: '🏢', title: 'Corporate Offices',
    body: 'Protect employees across every floor. Real-time zone monitoring with instant rerouting.' },
  { emoji: '🏥', title: 'Hospitals',
    body: "When patients can't move fast, every second matters. FireRoute guides staff precisely." },
  { emoji: '🏫', title: 'Schools',
    body: 'Thousands of students. One intelligent system. Calm, organized, safe evacuation.' },
  { emoji: '🛍️', title: 'Shopping Malls',
    body: 'High footfall. Complex layouts. FireRoute handles crowd-scale evacuation with ease.' },
  { emoji: '🏨', title: 'Hotels',
    body: 'Guests unfamiliar with layouts need more than exit signs. FireRoute guides them precisely.' },
  { emoji: '🏭', title: 'Factories',
    body: 'Industrial hazards move fast. FireRoute moves faster — rerouting around danger zones.' },
];

function UseCases() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    scrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grabbing';
  }
  function onMouseUp() {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeft.current - (x - startX.current);
  }

  const sectionRef = useScrollReveal<HTMLElement>();

  return (
    <section ref={sectionRef} id="use-cases" className="py-24 border-t border-white/5" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-12">
        <p className="scroll-reveal text-red-500 text-xs font-bold tracking-widest uppercase mb-3">Use Cases</p>
        <div className="flex items-end justify-between gap-4">
          <h2 className="scroll-reveal text-4xl sm:text-5xl font-black text-white" style={{ transitionDelay: '80ms' }}>
            Built for Every Building
          </h2>
          <p className="scroll-reveal text-[#444] text-sm hidden sm:block" style={{ transitionDelay: '120ms' }}>
            Drag to explore →
          </p>
        </div>
      </div>

      <div ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 px-5 sm:px-8 no-scrollbar"
        style={{ cursor: 'grab' }}
        onMouseDown={onMouseDown} onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp} onMouseMove={onMouseMove}>
        {USE_CASES.map(({ emoji, title, body }, i) => (
          <div key={title}
            className="scroll-reveal card-glow glass-card shrink-0 w-64 sm:w-72 rounded-2xl p-6"
            style={{ transitionDelay: `${i * 70}ms`, borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-3xl">{emoji}</span>
            <h3 className="text-white font-bold text-lg mt-4 mb-2">{title}</h3>
            <p className="text-[#666] text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
interface FinalCTAProps {
  user: ReturnType<typeof useAuth>['admin'];
  onSignup: () => void;
}

function FinalCTA({ user, onSignup }: FinalCTAProps) {
  const router = useRouter();
  const ref = useScrollReveal<HTMLElement>();

  function handleCTA() {
    if (user) router.push('/dashboard/admin');
    else onSignup();
  }

  return (
    <section ref={ref} id="contact" className="py-32 border-t border-white/5" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
        {/* Glow orb */}
        <div className="relative inline-block mb-10">
          <div className="w-24 h-24 rounded-full bg-red-600/20 border border-red-600/30 flex items-center justify-center mx-auto animate-glow-pulse">
            <Zap className="w-10 h-10 text-red-500" />
          </div>
          <div className="absolute inset-0 rounded-full blur-3xl bg-red-600/15 animate-glow-pulse" />
        </div>

        <h2 className="scroll-reveal text-5xl sm:text-6xl font-black text-white leading-tight">
          Make Your Building<br />
          <span className="gradient-text">Intelligent. Today.</span>
        </h2>
        <p className="scroll-reveal text-[#666] text-lg mt-6" style={{ transitionDelay: '100ms' }}>
          Setup takes minutes. Protection lasts forever.
        </p>

            <div className="flex flex-wrap gap-3 mt-10" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
              <MagneticButton onClick={handleCTA} strength={10}
                className="btn-shine btn-primary px-8 py-3.5 rounded-full text-white font-bold text-base cursor-pointer flex items-center gap-2 justify-center">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </MagneticButton>
              <MagneticButton onClick={handleCTA} strength={8}
                className="btn-shine btn-secondary px-8 py-3.5 rounded-full text-white font-semibold text-base cursor-pointer">
                See Live Demo
              </MagneticButton>
            </div>

        <p className="scroll-reveal text-[#444] text-sm mt-6" style={{ transitionDelay: '300ms' }}>
          No credit card required · Free forever for small buildings
        </p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/5 py-14 px-5 sm:px-8" id="footer" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">FireRoute</span>
          </div>
          <p className="text-[#555] text-sm leading-relaxed max-w-xs">
            Intelligent fire evacuation for every building. Real-time. Dynamic. Life-saving.
          </p>
          <p className="text-[#333] text-xs mt-4">Built with ❤️ for safer buildings</p>
        </div>

        {/* Product */}
        <div>
          <p className="text-white font-semibold text-sm mb-4">Product</p>
          <div className="flex flex-col gap-2.5">
            {['How it Works', 'Use Cases', 'Dashboard', 'Pricing'].map((l) => (
              <a key={l} href="#" className="text-[#555] hover:text-white text-sm transition-colors">{l}</a>
            ))}
          </div>
        </div>

        {/* Tech */}
        <div>
          <p className="text-white font-semibold text-sm mb-4">Technology</p>
          <div className="flex flex-wrap gap-2">
            {['ESP32', 'Next.js', 'Supabase', 'Three.js', 'Node.js'].map((tech) => (
              <span key={tech}
                className="text-xs px-3 py-1 rounded-full border border-white/8 text-[#555]"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-white/5 flex flex-wrap justify-between gap-4">
        <span className="text-[#333] text-xs">© 2025 FireRoute. All rights reserved.</span>
        <span className="text-[#333] text-xs">Privacy Policy · Terms of Service</span>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { admin: user, signOut } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'login' | 'signup'>('login');

  function openLogin()  { setModalTab('login');  setModalOpen(true); }
  function openSignup() { setModalTab('signup'); setModalOpen(true); }

  return (
    <div style={{ background: 'var(--bg)' }} className="min-h-screen">
      <CursorGlow />
      <Navbar user={user} onLogin={openLogin} onSignup={openSignup} onSignOut={signOut} />
      <Hero user={user} onSignup={openSignup} />
      <SocialProofBar />
      <AboutSection />
      <SolutionSection />
      <HowItWorks />
      <StatsSection />
      <UseCases />
      <FinalCTA user={user} onSignup={openSignup} />
      <Footer />
      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} defaultTab={modalTab} />
    </div>
  );
}
