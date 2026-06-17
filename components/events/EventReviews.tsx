'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';

interface Review {
  id: string;
  rating: number;
  body: string | null;
  display_name: string;
  created_at: string;
}

interface Stats { avg: number | null; count: number }

interface ReviewsData {
  reviews: Review[];
  eventStats: Stats;
  organizerStats: Stats;
}

interface Props {
  eventId: string;
  eventDate: string;
  onOrgReputation?: (avg: number | null, count: number) => void;
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= rating ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: i <= rating ? '#f59e0b' : 'var(--color-border)', flexShrink: 0 }}
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange, size = 30 }: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  const labels = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
            style={{
              background: 'none',
              border: 'none',
              padding: '3px',
              cursor: 'pointer',
              color: i <= active ? '#f59e0b' : 'var(--color-border)',
              lineHeight: 1,
              transition: 'color 0.1s',
            }}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={i <= active ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </svg>
          </button>
        ))}
        {active > 0 && (
          <span className="ml-1 text-sm font-medium" style={{ color: '#f59e0b' }}>
            {labels[active - 1]}
          </span>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function EventReviews({ eventId, eventDate, onOrgReputation }: Props) {
  const [data, setData]           = useState<ReviewsData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [rating, setRating]       = useState(0);
  const [body, setBody]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState('');

  const onRepRef = useRef(onOrgReputation);
  useEffect(() => { onRepRef.current = onOrgReputation; });

  const isPast = new Date(eventDate) < new Date();

  useEffect(() => {
    let mounted = true;
    fetch(`/api/events/${eventId}/reviews`)
      .then(r => r.json())
      .then(json => {
        if (!mounted || !json.success) return;
        setData(json.data);
        onRepRef.current?.(json.data.organizerStats.avg, json.data.organizerStats.count);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating first'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, body: body.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to submit review');
        return;
      }
      setSubmitted(true);
      // Optimistically add the review to the top of the list
      setData(prev => {
        if (!prev) return prev;
        const newCount = prev.eventStats.count + 1;
        const newAvg   = Math.round(
          (((prev.eventStats.avg ?? 0) * prev.eventStats.count) + rating) / newCount * 10
        ) / 10;
        return {
          ...prev,
          reviews:    [json.data, ...prev.reviews],
          eventStats: { avg: newAvg, count: newCount },
        };
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Don't render anything while loading, or if the event hasn't happened and there are no reviews
  if (loading) return null;
  if (!isPast && !data?.reviews?.length) return null;

  const hasReviews = (data?.reviews?.length ?? 0) > 0;
  const eventAvg   = data?.eventStats?.avg ?? null;
  const eventCount = data?.eventStats?.count ?? 0;

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-5"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          Reviews
        </h3>
        {eventAvg !== null && (
          <div className="flex items-center gap-2">
            <StarDisplay rating={Math.round(eventAvg)} size={14} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {eventAvg.toFixed(1)}
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              ({eventCount} {eventCount === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        )}
      </div>

      {/* Review form (only for past events, before submission) */}
      {isPast && !submitted && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-lg border p-4"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Rate this event
          </p>
          <StarPicker value={rating} onChange={setRating} size={28} />
          <Textarea
            placeholder="Share your experience… (optional)"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            maxLength={500}
          />
          {body.length > 0 && (
            <p className="text-xs text-right" style={{ color: 'var(--color-text-dim)' }}>
              {body.length}/500
            </p>
          )}
          {error && (
            <p className="text-xs" style={{ color: 'var(--color-red)' }}>{error}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              Posted anonymously · no account needed
            </p>
            <Button type="submit" size="sm" disabled={submitting || rating === 0}>
              {submitting ? 'Posting…' : 'Post Review'}
            </Button>
          </div>
        </form>
      )}

      {/* Success state after submission */}
      {isPast && submitted && (
        <div
          className="rounded-lg px-4 py-3 text-sm border"
          style={{
            backgroundColor: '#10b98112',
            borderColor: '#10b98128',
            color: 'var(--color-green)',
          }}
        >
          Thanks for your review! It has been posted.
        </div>
      )}

      {/* Review list */}
      {hasReviews ? (
        <div className="flex flex-col">
          {data!.reviews.map((review, i) => (
            <div
              key={review.id}
              className="flex flex-col gap-1.5 py-3"
              style={{
                borderTop: i === 0 ? `1px solid var(--color-border)` : `1px solid var(--color-border)`,
              }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <StarDisplay rating={review.rating} size={13} />
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {review.display_name}
                </span>
                <span style={{ color: 'var(--color-text-dim)' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                  {timeAgo(review.created_at)}
                </span>
              </div>
              {review.body && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {review.body}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        isPast && (
          <p className="text-sm text-center py-3" style={{ color: 'var(--color-text-dim)' }}>
            No reviews yet — be the first to share your experience.
          </p>
        )
      )}
    </div>
  );
}
