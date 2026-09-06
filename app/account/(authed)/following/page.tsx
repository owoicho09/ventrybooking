'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface FollowedOrganizer {
  id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  verified: boolean;
  tier: string;
}

export default function FollowingPage() {
  const [organizers, setOrganizers] = useState<FollowedOrganizer[] | null>(null);

  useEffect(() => {
    fetch('/api/buyer/following')
      .then(r => r.json())
      .then(d => setOrganizers(d.success ? d.data : []))
      .catch(() => setOrganizers([]));
  }, []);

  if (organizers === null) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;
  }

  if (organizers.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)' }}>
        You&apos;re not following any organisers yet. Follow one from their event page or profile to see their new events here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {organizers.map(org => (
        <Link
          key={org.id}
          href={org.handle ? `/${org.handle}` : '#'}
          className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:border-[var(--color-purple)]"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: 'var(--color-purple)' }}>
            {org.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={org.avatar_url} alt={org.name} className="w-full h-full object-cover" />
              : org.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{org.name}</p>
              {org.verified && <Badge variant="green"><CheckCircle size={10} />Verified</Badge>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
