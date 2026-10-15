'use client';

import { useState } from 'react';
import { ArrowUpRight, Clock, Landmark, WalletMinimal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatNGN } from '@/lib/utils';
import type { Wallet } from '@/lib/server/withdrawals';

const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * The organiser's wallet and how they're paid. 'bank': each day's sales go
 * to their bank the next working day, with "Withdraw now" for early payment.
 * 'wallet': sales build up here until they tap Withdraw (the admin then pays
 * it the same day).
 */
export function WalletCard({ wallet, onRequested }: { wallet: Wallet; onRequested: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingMethod, setSavingMethod] = useState(false);
  const isWallet = wallet.payoutMethod === 'wallet';

  const chooseMethod = async (method: 'bank' | 'wallet') => {
    if (savingMethod || method === wallet.payoutMethod) return;
    setSavingMethod(true); setMsg(null);
    try {
      const res = await fetch('/api/organizer/wallet/method', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success) setMsg({ ok: false, text: d?.error ?? 'Could not save your choice.' });
      else {
        setMsg({ ok: true, text: method === 'wallet'
          ? 'Saved. Your sales will stay in your Ventry wallet until you withdraw.'
          : 'Saved. Your balance will be paid to your bank in the next working-day payout.' });
        onRequested();
      }
    } catch {
      setMsg({ ok: false, text: 'Network error. Please try again.' });
    } finally {
      setSavingMethod(false);
    }
  };

  const option = (active: boolean) => ({
    borderColor: active ? 'var(--color-purple)' : 'var(--color-border)',
    backgroundColor: active ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
    color: active ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
  });

  const withdraw = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/organizer/wallet/withdraw', { method: 'POST' });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success) setMsg({ ok: false, text: d?.error ?? 'Could not send your request.' });
      else { setMsg({ ok: true, text: 'Request sent to Ventry. You’ll get an email as soon as it’s paid.' }); onRequested(); }
    } catch {
      setMsg({ ok: false, text: 'Network error. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const req = wallet.pendingRequest;
  const lastClosed = !req && wallet.lastRequest?.status === 'cancelled' ? wallet.lastRequest : null;

  return (
    <div className="rounded-xl border p-5 sm:p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>How do you want to be paid?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => chooseMethod('bank')} disabled={savingMethod}
            className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors" style={option(!isWallet)}>
            <span className="flex items-center gap-1.5"><Landmark size={14} />Straight to my bank</span>
            <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Each day&apos;s sales are paid automatically the next working day</span>
          </button>
          <button type="button" onClick={() => chooseMethod('wallet')} disabled={savingMethod}
            className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors" style={option(isWallet)}>
            <span className="flex items-center gap-1.5"><WalletMinimal size={14} />Keep in my Ventry wallet</span>
            <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Sales build up here; withdraw to your bank whenever you like</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>Wallet · {isWallet ? 'available to withdraw' : 'available now'}</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>{formatNGN(wallet.available)}</p>
          {wallet.next && (
            <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <Clock size={12} />{formatNGN(wallet.next.amount)} more becomes available {day(wallet.next.on)}
            </p>
          )}
        </div>
        {!req && (
          <Button onClick={withdraw} disabled={busy || wallet.available <= 0 || wallet.blockers.length > 0}>
            <ArrowUpRight size={15} />{busy ? 'Sending…' : `Withdraw ${wallet.available > 0 ? formatNGN(wallet.available) : ''}${isWallet ? '' : ' now'}`}
          </Button>
        )}
      </div>

      {req && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-text)' }}>
          You asked to withdraw {formatNGN(req.amount)} on {new Date(req.requested_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}.
          Ventry has been notified and will pay it to your bank account; you&apos;ll get an email when it&apos;s sent.
        </p>
      )}
      {lastClosed?.note && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Your last request was closed: {lastClosed.note}</p>
      )}
      {wallet.available > 0 && wallet.blockers.map(b => (
        <p key={b} className="text-xs" style={{ color: 'var(--color-red)' }}>{b}</p>
      ))}
      {msg && <p className="text-sm" style={{ color: msg.ok ? 'var(--color-green)' : 'var(--color-red)' }}>{msg.text}</p>}

      <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
        {isWallet
          ? <>Your sales stay in your wallet until you withdraw. Each day&apos;s sales become available to withdraw the next working day, after Ventry&apos;s 3% fee. Tap Withdraw and Ventry pays the full balance to your bank account, usually the same working day.</>
          : <>You don&apos;t need to do anything to get paid: each working day&apos;s sales are settled to your bank the next working day. Withdraw now is for when you&apos;d like what&apos;s available today without waiting for that run.</>}
      </p>
    </div>
  );
}
