import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { RefundClaimForm } from '@/components/refunds/RefundClaimForm';

export const metadata: Metadata = {
  title: 'Claim a refund | Ventry',
  description: 'Claim a refund for a cancelled or changed event, or a billed headliner who did not appear.',
};

export default async function RefundClaimPage({ searchParams }: { searchParams: Promise<{ ticket?: string; code?: string; type?: string }> }) {
  const sp = await searchParams;
  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <main className="pt-16 max-w-xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Claim a refund</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
          Ventry runs the claim; the organiser pays you directly. You need the ticket ID from your ticket email, and access to the email address you bought with.
        </p>
        <RefundClaimForm initialTicket={sp.ticket ?? ''} initialCode={sp.code ?? ''} initialMode={sp.type === 'no_show' ? 'no_show' : 'refund'} />
      </main>
      <Footer />
    </div>
  );
}
