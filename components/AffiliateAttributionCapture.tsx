'use client';

import { useEffect } from 'react';

/**
 * Captures ?aff=CODE from any page's URL into a 30-day cookie, so a platform
 * affiliate's referral link works regardless of what page it lands on or
 * whether the visitor registers as an organiser immediately or days later.
 * Read server-side at organiser registration (see /api/auth/organizer/register)
 * to resolve attribution — first-touch only, never overwritten by a later click.
 */
export function AffiliateAttributionCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('aff');
    if (!code) return;
    document.cookie = `ventry_aff=${encodeURIComponent(code)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
  }, []);

  return null;
}
