'use client';

import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function FollowButton({ handle }: { handle: string }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/organizers/${handle}/follow`)
      .then(r => r.json())
      .then(d => setFollowing(!!d?.data?.following))
      .finally(() => setLoading(false));
  }, [handle]);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/organizers/${handle}/follow`, { method: following ? 'DELETE' : 'POST' });
      if (res.ok) setFollowing(f => !f);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <Button variant={following ? 'outline' : 'primary'} size="sm" onClick={toggle} disabled={busy}>
      {following ? <><Check size={14} />Following</> : <><Plus size={14} />Follow</>}
    </Button>
  );
}
