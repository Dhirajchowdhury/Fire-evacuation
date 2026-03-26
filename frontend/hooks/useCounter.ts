'use client';
import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Animates from 0 → `target` over `duration` ms using easeOutExpo.
 * Starts when `active` becomes true.
 * Returns the current display value as a string (formatted with `format`).
 */
export function useCounter(
  target: number,
  active: boolean,
  duration = 1800,
  format: (n: number) => string = (n) => Math.round(n).toLocaleString(),
): string {
  const [display, setDisplay] = useState('0');
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(format(target));
      return;
    }

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      setDisplay(format(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, duration, format]);

  return display;
}
