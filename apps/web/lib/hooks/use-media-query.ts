'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe media query hook. Returns false during SSR and on first paint to avoid
 * hydration mismatches, then resolves to the real value after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** True when viewport is below md breakpoint (< 768px) */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/** True when viewport is below lg breakpoint (< 1024px) */
export function useIsTabletOrBelow(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
