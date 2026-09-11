'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';

interface AffiliateRow {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  createdAt: string;
  referralCount: number;
  pendingCommission: number;
  paidCommission: number;
}

const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/affiliates')
      .then(r => r.json())
      .then(d => { if (d.success) setAffiliates(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Affiliates</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Marketers who refer organisers to Ventry, earning 30% of Ventry&apos;s service fee on each referral&apos;s first three events.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : affiliates.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No affiliates yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Affiliate</Th>
                <Th>Referral Code</Th>
                <Th>Referrals</Th>
                <Th>Pending</Th>
                <Th>Paid</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {affiliates.map(a => (
                <Tr key={a.id}>
                  <Td>
                    <p style={{ color: 'var(--color-text)' }}>{a.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{a.email}</p>
                  </Td>
                  <Td><code className="text-xs">{a.referralCode}</code></Td>
                  <Td>{a.referralCount}</Td>
                  <Td>{fmt(a.pendingCommission)}</Td>
                  <Td>{fmt(a.paidCommission)}</Td>
                  <Td>
                    <Link href={`/admin/affiliates/${a.id}`} className="text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
                      View
                    </Link>
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
