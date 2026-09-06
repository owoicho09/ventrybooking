'use client';

import { useEffect, useState } from 'react';

/** Client-side buyer session check, shared by every component that needs to
 * branch on "is a buyer logged in" — the header link, checkout pre-fill, and
 * the Follow button's choice between itself and the logged-out Notify Me form. */
export function useBuyerAuth() {
  const [email, setEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/buyer/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        setEmail(d?.data?.email ?? null);
        setFirstName(d?.data?.firstName ?? null);
      })
      .catch(() => setEmail(null))
      .finally(() => setLoading(false));
  }, []);

  return { email, firstName, loggedIn: !!email, loading };
}
