'use client';

import { useEffect, useState } from 'react';
import { formatShortDate } from '@/lib/utils';

interface MyReview {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  eventName: string;
}

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState<MyReview[] | null>(null);

  useEffect(() => {
    fetch('/api/buyer/reviews')
      .then(r => r.json())
      .then(d => setReviews(d.success ? d.data : []))
      .catch(() => setReviews([]));
  }, []);

  if (reviews === null) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;
  }

  if (reviews.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)' }}>
        You haven&apos;t left any reviews yet. You can review an event after attending it.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map(r => (
        <div key={r.id} className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{r.eventName}</p>
            <span style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
          </div>
          {r.body && <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>{r.body}</p>}
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{formatShortDate(r.created_at)}</p>
        </div>
      ))}
    </div>
  );
}
