'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicNav } from '@/components/layout/PublicNav';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function PendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref') ?? '';
  const [attempts, setAttempts] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ref) return;

    const start = () => {
      timerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/tickets/by-reference?ref=${ref}`);
          const data = await res.json();
          if (data.success && data.data?.id) {
            clearInterval(timerRef.current!);
            router.push(`/ticket/${data.data.id}`);
          }
        } catch { /* keep polling */ }
        setAttempts(a => a + 1);
      }, 2000);
    };

    const pause = () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };

    const handleVisibility = () => {
      if (document.hidden) pause(); else start();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    start();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [ref, router]);

  const handleVerify = () => {
    if (!ref || verifying) return;
    setVerifying(true);
    // Navigate to callback which calls Paystack verify API directly
    window.location.href = `/api/paystack/callback?reference=${ref}`;
  };

  const showFallback = attempts > 8; // ~16 seconds

  return (
    <div className="pt-24 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: 'var(--color-purple-dim)' }}>
        <Clock size={36} style={{ color: 'var(--color-purple-light)' }} />
      </div>

      <h1 className="text-2xl font-bold mb-3"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        Processing Your Payment
      </h1>
      <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
        Confirming your ticket… this usually takes a few seconds.
      </p>

      {showFallback ? (
        <div className="mt-6 flex flex-col items-center gap-4 max-w-sm">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Taking longer than expected. Click below to check your payment status directly with Paystack.
          </p>
          <Button onClick={handleVerify} disabled={verifying}>
            <RefreshCw size={15} className={verifying ? 'animate-spin' : ''} />
            {verifying ? 'Checking…' : 'Verify My Payment'}
          </Button>
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
            Already have a ticket?{' '}
            <a href="/retrieve" style={{ color: 'var(--color-purple-light)', textDecoration: 'underline' }}>
              Retrieve it here
            </a>
          </p>
        </div>
      ) : (
        <div className="flex gap-1.5 mt-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--color-purple)', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentPendingPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <Suspense fallback={
        <div className="pt-24 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
      }>
        <PendingContent />
      </Suspense>
    </div>
  );
}
