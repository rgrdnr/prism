'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useScreensaverTimeout } from './useScreensaverTimeout';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function isDashboard(path: string) {
  return path === '/' || path.startsWith('/d/');
}

/**
 * Redirects to the dashboard (/) after 5 minutes of user inactivity.
 * Only applies when the user is not already on a dashboard page, and only
 * when the screensaver is disabled ("Never").
 *
 * When the screensaver is enabled it already covers the screen well before
 * this fires (2 min default vs. 5 min here) and serves as the "someone
 * walked away" signal on its own — this redirect used to keep running
 * underneath it regardless, so returning from the screensaver after a long
 * idle stretch dropped you on the dashboard instead of wherever you'd left
 * off. With the screensaver on, trust it instead of also resetting the route.
 *
 * Deliberately avoids usePathname() to prevent adding a second pathname
 * subscription to AppShell (useAutoHideUI already has one), which would
 * cause double re-renders on every navigation on slow devices.
 */
export function useInactivityRedirect() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { timeout: screensaverTimeout } = useScreensaverTimeout();
  const screensaverTimeoutRef = useRef(screensaverTimeout);
  screensaverTimeoutRef.current = screensaverTimeout;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Screensaver disabled ("Never" = 0) is the only case with no other
        // idle signal, so it's the only case this still resets the route.
        if (screensaverTimeoutRef.current !== 0) return;
        // Read pathname at fire time — no subscription needed
        if (!isDashboard(window.location.pathname)) {
          routerRef.current.push('/');
        }
      }, INACTIVITY_TIMEOUT);
    }

    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
