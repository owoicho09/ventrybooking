'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Preview {
  eventName: string;
  buyerName: string;
  changeType: 'venue' | 'date' | 'venue_and_date';
  oldValue: { venue?: string; address?: string; city?: string; date?: string; time?: string };
  newValue: { venue?: string; address?: string; city?: string; date?: string; time?: string };
  refundAmount: number;
  windowClosesAt: string;
  eligible: boolean;
  alreadyProcessed: boolean;
  ticketStatus: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

const CHANGE_LABEL: Record<Preview['changeType'], string> = {
  venue: 'venue',
  date: 'date',
  venue_and_date: 'date and venue',
};

export default function RefundOptOutPage() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ refunded?: boolean; amount?: number; alreadyProcessed?: boolean } | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/refund-opt-out/${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setLoadError(d.error || 'This link is invalid.'); return; }
        setPreview(d.data);
      })
      .catch(() => setLoadError('Could not load this refund request. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  const confirmRefund = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/refund-opt-out/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || 'Something went wrong.'); return; }
      setResult(data.data);
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

        {!loading && preview && !result && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
                {preview.eventName}
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                The organiser changed this event&apos;s {CHANGE_LABEL[preview.changeType]}.
              </p>
            </div>

            <div className="rounded-xl border p-5 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              {(preview.newValue.date || preview.newValue.time) && (
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-dim)' }}>New date &amp; time</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{preview.newValue.date} &middot; {preview.newValue.time}</p>
                </div>
              )}
              {preview.newValue.venue && (
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-dim)' }}>New venue</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{preview.newValue.venue}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{preview.newValue.address}{preview.newValue.city ? `, ${preview.newValue.city}` : ''}</p>
                </div>
              )}
            </div>

            {preview.eligible ? (
              <>
                <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-purple-dim)', borderColor: '#7c3aed30' }}>
                  <p className="text-sm mb-1" style={{ color: 'var(--color-text)' }}>
                    If the new details don&apos;t work for you, request a full refund of <strong>{fmt(preview.refundAmount)}</strong> — no account or support ticket needed.
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    This link closes on {new Date(preview.windowClosesAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })}.
                  </p>
                </div>
                <Button size="lg" fullWidth disabled={submitting} onClick={confirmRefund}>
                  {submitting ? 'Processing…' : `Request Refund (${fmt(preview.refundAmount)})`}
                </Button>
                {submitError && <p className="text-sm text-center" style={{ color: 'var(--color-red)' }}>{submitError}</p>}
                <p className="text-xs text-center" style={{ color: 'var(--color-text-dim)' }}>
                  Happy with the new details? No action needed — your ticket stays valid as-is.
                </p>
              </>
            ) : (
              <div className="rounded-xl border p-5 text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {preview.alreadyProcessed
                    ? 'This ticket has already been refunded.'
                    : preview.ticketStatus !== 'valid'
                    ? 'This ticket is no longer eligible for a refund.'
                    : 'The refund window for this change has closed.'}
                </p>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-xl border p-6 text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <CheckCircle size={28} style={{ color: 'var(--color-green)' }} className="mx-auto mb-3" />
            <p style={{ color: 'var(--color-text)' }}>
              {result.alreadyProcessed
                ? 'This ticket was already refunded.'
                : `Your refund${result.amount ? ` of ${fmt(result.amount)}` : ''} has been processed. It will appear in your account within 3–5 business days.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
