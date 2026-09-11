'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, LogOut, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { NIGERIAN_BANKS } from '@/lib/banks';

interface Me {
  name: string;
  email: string;
  referralCode: string;
  referralLink: string;
  referralCount: number;
  pendingCommission: number;
  paidCommission: number;
  phone: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

interface Sale {
  eventName: string;
  grossAmount: number;
  commissionAmount: number;
  eventSequenceNumber: number;
  status: 'pending' | 'paid' | 'void';
  createdAt: string;
}

interface Referral {
  organizerName: string;
  organizerHandle: string | null;
  referredAt: string;
  qualifyingEventsSoFar: number;
  capReached: boolean;
  totalCommission: number;
  pendingCommission: number;
  sales: Sale[];
}

const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

export default function AffiliateDashboardPage() {
  const { toast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBank, setEditingBank] = useState(false);
  const [bank, setBank] = useState({ phone: '', bankName: '', accountNumber: '' });
  const [bankMsg, setBankMsg] = useState('');
  const [bankSaving, setBankSaving] = useState(false);

  const loadMe = () => {
    Promise.all([
      fetch('/api/affiliate/me').then(r => r.json()),
      fetch('/api/affiliate/referrals').then(r => r.json()),
    ])
      .then(([meRes, refRes]) => {
        if (meRes.success) {
          setMe(meRes.data);
          setBank({
            phone: meRes.data.phone || '',
            bankName: meRes.data.bankName || '',
            accountNumber: meRes.data.accountNumber || '',
          });
        }
        if (refRes.success) setReferrals(refRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMe(); }, []);

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankSaving(true); setBankMsg('');
    const res = await fetch('/api/affiliate/bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bank),
    });
    const d = await res.json();
    setBankMsg(d.success ? 'Bank details saved.' : (d.error ?? 'Failed to save bank details'));
    setBankSaving(false);
    if (d.success) { setEditingBank(false); loadMe(); }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/affiliate/login';
  };

  const copyLink = async () => {
    if (!me) return;
    try {
      await navigator.clipboard.writeText(me.referralLink);
      toast('Referral link copied', 'success');
    } catch {
      toast('Could not copy link', 'error');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>;
  }
  if (!me) return null;

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
              <span style={{ color: 'var(--color-purple)' }}>V</span>
              <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
            </Link>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Affiliate Dashboard &middot; {me.name}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <LogOut size={14} />Logout
          </button>
        </div>

        {/* Referral link */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>Your referral link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm px-3 py-2 rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
              {me.referralLink}
            </code>
            <Button size="sm" onClick={copyLink}><Copy size={13} />Copy</Button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-dim)' }}>
            Share this with organisers. You earn 30% of Ventry&apos;s service fee on their first three events.
          </p>
        </div>

        {/* Bank Details */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Bank details</p>
            <button onClick={() => setEditingBank(!editingBank)} className="text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
              {editingBank ? 'Cancel' : me?.accountNumber ? 'Edit' : 'Add'}
            </button>
          </div>
          {!editingBank ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Bank</span>
                <span style={{ color: 'var(--color-text)' }}>{me?.bankName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Account</span>
                <span className="font-mono" style={{ color: 'var(--color-text)' }}>
                  {me?.accountNumber ? `****${me.accountNumber.slice(-4)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-muted)' }}>Account Name</span>
                <span style={{ color: 'var(--color-text)' }}>{me?.accountName || '—'}</span>
              </div>
              {!me?.accountNumber && (
                <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Add your bank details so commission can be paid to you.</p>
              )}
            </div>
          ) : (
            <form onSubmit={saveBank} className="flex flex-col gap-4">
              <Input
                label="Phone Number"
                type="tel"
                value={bank.phone}
                onChange={e => setBank(b => ({ ...b, phone: e.target.value }))}
                placeholder="+234 801 234 5678"
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Bank</label>
                <select
                  value={bank.bankName}
                  onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))}
                  required
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-purple)]"
                  style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  <option value="" disabled>Select your bank</option>
                  {NIGERIAN_BANKS.map(b => (
                    <option key={b.code} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Account Number"
                value={bank.accountNumber}
                onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))}
                placeholder="10-digit account number"
                maxLength={10}
                required
              />
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                Must be an account in your own name — we verify this against the bank before saving.
              </p>
              {bankMsg && (
                <p className="text-xs" style={{ color: bankMsg.includes('saved') ? 'var(--color-green)' : 'var(--color-red)' }}>
                  {bankMsg}
                </p>
              )}
              <Button type="submit" disabled={bankSaving}>{bankSaving ? 'Saving…' : 'Save Bank Details'}</Button>
            </form>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border p-5 flex items-center gap-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}><Users size={16} /></div>
            <div>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{me.referralCount}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Organisers referred</p>
            </div>
          </div>
          <div className="rounded-xl border p-5 flex items-center gap-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f59e0b15', color: 'var(--color-amber)' }}><Wallet size={16} /></div>
            <div>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{fmt(me.pendingCommission)}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Pending commission</p>
            </div>
          </div>
          <div className="rounded-xl border p-5 flex items-center gap-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10b98115', color: 'var(--color-green)' }}><Wallet size={16} /></div>
            <div>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{fmt(me.paidCommission)}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Paid out so far</p>
            </div>
          </div>
        </div>

        {/* Referrals */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Your Referrals</h2>
          {referrals.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No referrals yet — share your link above to get started.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {referrals.map((r, i) => (
                <div key={i} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>{r.organizerName}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Referred {new Date(r.referredAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{fmt(r.totalCommission)}</p>
                      {r.capReached && <Badge variant="gray">Cap reached (3 events)</Badge>}
                    </div>
                  </div>
                  {r.sales.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      {r.sales.map((s, j) => (
                        <div key={j} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {s.eventName} <span style={{ color: 'var(--color-text-dim)' }}>(event {s.eventSequenceNumber})</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span style={{ color: 'var(--color-text)' }}>{fmt(s.commissionAmount)}</span>
                            {s.status === 'paid' ? <Badge variant="green">Paid</Badge>
                              : s.status === 'void' ? <Badge variant="gray">Voided</Badge>
                              : <Badge variant="amber">Pending</Badge>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
