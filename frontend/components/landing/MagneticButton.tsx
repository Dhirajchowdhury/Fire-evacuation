'use client';
import { useRef, useCallback } from 'react';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  strength?: number; // px — how far the button travels, default 12
}

export default function MagneticButton({
  children,
  className = '',
  onClick,
  href,
  strength = 12,
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);
  // Track current offset for lerp
  const current = useRef({ x: 0, y: 0 });
  const target  = useRef({ x: 0, y: 0 });
  const rafId   = useRef<number>(0);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const animate = useCallback(() => {
    if (!ref.current) return;
    current.current.x = lerp(current.current.x, target.current.x, 0.12);
    current.current.y = lerp(current.current.y, target.current.y, 0.12);
    ref.current.style.transform =
      `translate(${current.current.x}px, ${current.current.y}px)`;

    const dx = Math.abs(target.current.x - current.current.x);
    const dy = Math.abs(target.current.y - current.current.y);
    if (dx > 0.05 || dy > 0.05) {
      rafId.current = requestAnimationFrame(animate);
    }
  }, []);

  function onMouseMove(e: React.MouseEvent<HTMLElement>) {
    // Disable on touch/mobile — check pointer type
    if (window.matchMedia('(hover: none)').matches) return;

    const rect = ref.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width  / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);

    target.current = { x: dx * strength, y: dy * strength };
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(animate);
  }

  function onMouseLeave() {
    target.current = { x: 0, y: 0 };
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(animate);
  }

  const sharedProps = {
    ref: ref as React.RefObject<HTMLAnchorElement & HTMLButtonElement>,
    className,
    onMouseMove,
    onMouseLeave,
    style: { willChange: 'transform', display: 'inline-block' } as React.CSSProperties,
  };

  if (href) {
    return (
      <a {...sharedProps} href={href}>
        {children}
      </a>
    );
  }

  return (
    <button {...sharedProps} onClick={onClick} type="button">
      {children}
    </button>
  );
}
