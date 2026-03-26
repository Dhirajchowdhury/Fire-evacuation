'use client';
import { useEffect, useRef } from 'react';

/**
 * Attaches an IntersectionObserver to a container ref.
 * Any child with class `scroll-reveal` gets `revealed` added when it enters
 * the viewport. Cleans up the observer on unmount.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  threshold = 0.15,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    // Respect reduced-motion — mark everything visible immediately
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current
        ?.querySelectorAll<HTMLElement>('.scroll-reveal')
        .forEach((el) => el.classList.add('revealed'));
      return;
    }

    const container = ref.current;
    if (!container) return;

    const targets = container.querySelectorAll<HTMLElement>('.scroll-reveal');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target); // fire once
          }
        });
      },
      { threshold },
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
