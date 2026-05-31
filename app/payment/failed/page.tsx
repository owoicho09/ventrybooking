'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Button } from '@/components/ui/Button';

function FailedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'Your payment was not completed.';

  return (
    <div className="pt-24 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: '#ef444415' }}>
        <XCircle size={36} style={{ color: 'var(--color-red)' }} />
      </div>
      <h1 className="text-2xl font-bold mb-3"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        Payment Not Completed
      </h1>
      <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--color-text-muted)' }}>
        {decodeURIComponent(reason)}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/events">
          <Button>Browse Events</Button>
        </Link>
        <Link href="/retrieve">
          <Button variant="outline">Retrieve Existing Ticket</Button>
        </Link>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <Suspense fallback={<div className="pt-24 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>}>
        <FailedContent />
      </Suspense>
    </div>
  );
}
