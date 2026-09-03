'use client';

import { useState, useEffect } from 'react';
import { EyeOff, Eye, Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatShortDate } from '@/lib/utils';

interface ReviewRow {
  id: string;
  eventId: string;
  eventName: string;
  rating: number;
  body: string | null;
  displayName: string;
  hidden: boolean;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/reviews')
      .then(r => r.json())
      .then(d => { if (d.success) setReviews(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleHidden = async (id: string, hidden: boolean) => {
    setActingId(id);
    try {
      await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden }),
      });
      load();
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Reviews</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Every review left by a checked-in ticket holder. Hide anything abusive or off-topic — it disappears from the event page and organiser profile immediately.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No reviews yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Event</Th>
                <Th>Rating</Th>
                <Th>Review</Th>
                <Th>By</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {reviews.map(r => (
                <Tr key={r.id}>
                  <Td>{r.eventName}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1">
                      <Star size={13} fill="#f59e0b" stroke="#f59e0b" />{r.rating}
                    </span>
                  </Td>
                  <Td className="max-w-xs truncate">{r.body || <span style={{ color: 'var(--color-text-dim)' }}>—</span>}</Td>
                  <Td>{r.displayName}</Td>
                  <Td>{formatShortDate(r.createdAt)}</Td>
                  <Td>{r.hidden ? <Badge variant="gray">Hidden</Badge> : <Badge variant="green">Visible</Badge>}</Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === r.id}
                      onClick={() => toggleHidden(r.id, !r.hidden)}
                    >
                      {r.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                      {r.hidden ? 'Unhide' : 'Hide'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
