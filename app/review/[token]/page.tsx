'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';

interface Preview {
  eventName: string;
  buyerName: string;
  alreadyReviewed: boolean;
  existingReview: { rating: number; body: string | null } | null;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  const labels = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          style={{ background: 'none', border: 'none', padding: 3, cursor: 'pointer', color: i <= active ? '#f59e0b' : 'var(--color-border)' }}
        >
          <svg width={32} height={32} viewBox="0 0 24 24" fill={i <= active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </button>
      ))}
      {active > 0 && <span className="ml-1 text-sm font-medium" style={{ color: '#f59e0b' }}>{labels[active - 1]}</span>}
    </div>
  );
}

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/review/${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setLoadError(d.error || 'This link is invalid.'); return; }
        setPreview(d.data);
      })
      .catch(() => setLoadError('Could not load this review link. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setSubmitError('Please select a star rating first'); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, body: body.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || 'Failed to submit review'); return; }
      setSubmitted(true);
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
          <span style={{ color: 'var(--color-purple)' }}>V</span>
          <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
        </Link>
      </div>

      <div className="max-w-md mx-auto px-6 py-10">
        {loading && <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

        {!loading && loadError && (
          <div className="rounded-xl border p-6 text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <AlertTriangle size={28} style={{ color: 'var(--color-amber)' }} className="mx-auto mb-3" />
            <p style={{ color: 'var(--color-text)' }}>{loadError}</p>
          </div>
        )}

        {!loading && preview && !submitted && (
          preview.alreadyReviewed ? (
            <div className="rounded-xl border p-6 text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <CheckCircle size={28} style={{ color: 'var(--color-green)' }} className="mx-auto mb-3" />
              <p style={{ color: 'var(--color-text)' }}>You&apos;ve already reviewed {preview.eventName}. Thanks for sharing your experience!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
                  {preview.eventName}
                </h1>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Hi {preview.buyerName || 'there'}, how was it?
                </p>
              </div>
              <div className="rounded-xl border p-5 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <StarPicker value={rating} onChange={setRating} />
                <Textarea
                  placeholder="Share your experience… (optional)"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                {body.length > 0 && (
                  <p className="text-xs text-right" style={{ color: 'var(--color-text-dim)' }}>{body.length}/500</p>
                )}
              </div>
              {submitError && <p className="text-sm text-center" style={{ color: 'var(--color-red)' }}>{submitError}</p>}
              <Button type="submit" size="lg" fullWidth disabled={submitting || rating === 0}>
                {submitting ? 'Posting…' : 'Submit Review'}
              </Button>
            </form>
          )
        )}

        {submitted && (
          <div className="rounded-xl border p-6 text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <CheckCircle size={28} style={{ color: 'var(--color-green)' }} className="mx-auto mb-3" />
            <p style={{ color: 'var(--color-text)' }}>Thanks for your review! It has been posted.</p>
          </div>
        )}
      </div>
    </div>
  );
}
