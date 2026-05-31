'use client';

import { useState, useEffect } from 'react';
import { Wallet, Edit3, CheckCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { formatNGN, formatShortDate } from '@/lib/utils';

interface Payout { id: string; event_name: string; date: string; gross: number; fee: number; net: number; status: string; reference: string; }

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed': return <Badge variant="green">Completed</Badge>;
    case 'processing': return <Badge variant="amber">Processing</Badge>;
    case 'pending': return <Badge variant="gray">Pending</Badge>;
    default: return <Badge variant="gray">{status}</Badge>;
  }
};

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutDue, setPayoutDue] = useState(0);
  const [editingBank, setEditingBank] = useState(false);
  const [bank, setBank] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [bankMsg, setBankMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/organizer/payouts').then(r => r.json()),
      fetch('/api/organizer/stats').then(r => r.json()),
      fetch('/api/organizer/me').then(r => r.json()),
    ]).then(([p, s, m]) => {
      if (p.success) setPayouts(p.data);
      if (s.success) setPayoutDue(s.data.payoutDue);
      if (m.success) setBank({ bankName: m.data.bank_name || '', accountNumber: m.data.account_number || '', accountName: m.data.account_name || '' });
    }).catch(console.error);
  }, []);

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setBankMsg('');
    const res = await fetch('/api/organizer/bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bank) });
    const d = await res.json();
    setBankMsg(d.success ? 'Bank details saved.' : d.error);
    setSaving(false);
    if (d.success) setEditingBank(false);
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Payouts</h1>

      <div className="rounded-xl border p-6" style={{ background: 'linear-gradient(135deg, #1a0a3d 0%, #0f0a2d 100%)', borderColor: '#7c3aed40' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(124,58,237,0.3)' }}>
            <Wallet size={20} color="#a855f7" />
          </div>
          <div>
            <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Upcoming Payout</p>
            <p className="text-4xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>{formatNGN(payoutDue)}</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Expected within 24-48hrs after event</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Payout History</h2>
        </div>
        {payouts.length === 0 && <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>No payouts yet.</p>}
        {payouts.length > 0 && <Table>
          <Thead>
            <tr><Th>Event</Th><Th>Date</Th><Th>Ticket Revenue</Th><Th>Platform fee (2.5%)</Th><Th>Your Payout</Th><Th>Status</Th><Th>Reference</Th></tr>
          </Thead>
          <Tbody>
            {payouts.map((payout) => (
              <Tr key={payout.id}>
                <Td><p className="font-medium text-sm max-w-[160px] truncate" style={{ color: 'var(--color-text)' }}>{payout.event_name}</p></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(payout.date)}</span></Td>
                <Td><span style={{ color: 'var(--color-text)' }}>{formatNGN(payout.gross)}</span></Td>
                <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatNGN(payout.fee)}</span></Td>
                <Td><span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatNGN(payout.net)}</span></Td>
                <Td>{statusBadge(payout.status)}</Td>
                <Td><span className="text-xs font-mono" style={{ color: 'var(--color-text-dim)' }}>{payout.reference}</span></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>}
      </div>

      <div className="rounded-xl border p-4 flex items-start gap-3"
        style={{ backgroundColor: '#f59e0b10', borderColor: '#f59e0b40' }}>
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-amber)' }} />
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>Cancellation policy:</span>{' '}
          If you cancel an event, all buyers are refunded their base ticket price. The 2.5% platform fee is non-recoverable — Ventry absorbs the refund processing cost but you forfeit any claim to the fee on cancelled sales.
        </p>
      </div>

      <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Bank Account</h2>
          <button onClick={() => setEditingBank(!editingBank)} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
            <Edit3 size={14} />{editingBank ? 'Cancel' : 'Edit Bank Details'}
          </button>
        </div>

        {!editingBank ? (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm"><span style={{ color: 'var(--color-text-muted)' }}>Bank Name</span><span className="font-medium" style={{ color: 'var(--color-text)' }}>{bank.bankName || '—'}</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: 'var(--color-text-muted)' }}>Account Number</span><span className="font-mono font-medium" style={{ color: 'var(--color-text)' }}>{bank.accountNumber ? `****${bank.accountNumber.slice(-4)}` : '—'}</span></div>
            {bank.accountNumber && <div className="flex items-center gap-2 mt-1"><CheckCircle size={14} style={{ color: 'var(--color-green)' }} /><span className="text-xs" style={{ color: 'var(--color-green)' }}>Verified account</span></div>}
          </div>
        ) : (
          <form onSubmit={saveBank} className="flex flex-col gap-4">
            <Input label="Bank Name" value={bank.bankName} onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))} placeholder="e.g. Zenith Bank" />
            <Input label="Account Number" value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))} placeholder="10-digit account number" />
            <Input label="Account Name" value={bank.accountName} onChange={e => setBank(b => ({ ...b, accountName: e.target.value }))} placeholder="Name as on bank account" />
            {bankMsg && <p className="text-xs" style={{ color: bankMsg.includes('saved') ? 'var(--color-green)' : 'var(--color-red)' }}>{bankMsg}</p>}
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Bank Details'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
