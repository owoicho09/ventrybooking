'use client';

import { useCallback, useState } from 'react';

/**
 * Signs the organiser out and does a full page load to the login screen, so
 * no cached dashboard data survives. Shared by the sidebar, the mobile menu
 * and the dashboard header.
 */
export function useOrganizerLogout() {
  const [loggingOut, setLoggingOut] = useState(false);
  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      try { sessionStorage.removeItem('ventry_change_grant'); } catch { /* storage off */ }
      window.location.href = '/organizer/login';
    }
  }, []);
  return { logout, loggingOut };
}
