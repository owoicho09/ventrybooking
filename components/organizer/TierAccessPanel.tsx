'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import {
  GateToggleRow, Switch, PROMO_INFO, DOMAIN_INFO, CODE_RULES, normalizeCodeInput, codeInputProblem,
  domainConflict, parseDomainList, DomainConflictWarning,
} from '@/components/organizer/TierGateFields';

interface Code { id: string; code: string; active: boolean; createdAt: string; ticketsSold: number }

/**
 * Who-can-buy settings for a tier that already exists. Every change saves
 * straight away (the toggles, each code's on/off switch, new codes), so there
 * is no separate save button to forget.
 */
export function TierAccessPanel({ eventId, tier, onChanged, eventDomains }: {
  eventId: string;
  /** The event-wide email gate, to warn when it and this tier's gate can't both pass. */
  eventDomains?: string[] | null;
  tier: { id: string; name: string; requires_code?: boolean | null; allowed_email_domains?: string[] | null };
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const base = `/api/organizer/events/${eventId}/tiers/${tier.id}`;
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [domainsOn, setDomainsOn] = useState(!!tier.allowed_email_domains?.length);
  const [domainsInput, setDomainsInput] = useState((tier.allowed_email_domains ?? []).join(', '));
  const savedDomains = (tier.allowed_email_domains ?? []).join(', ');

  const loadCodes = useCallback(() => {
    fetch(`${base}/codes`).then(r => r.json()).then(d => { if (d.success) setCodes(d.data); }).catch(() => setCodes([]));
  }, [base]);
  useEffect(() => { loadCodes(); }, [loadCodes]);

  const patchTier = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error || 'Could not save', 'error'); return false; }
      toast(okMsg, 'success');
      onChanged();
      return true;
    } finally { setBusy(false); }
  };

  const togglePromo = (on: boolean) => {
    if (!on && !window.confirm(`Turn off the promo code for "${tier.name}"? Anyone will be able to buy it. Your codes are kept in case you turn it back on.`)) return;
    patchTier({ requires_code: on }, on ? 'Promo code switched on' : 'Promo code switched off. This ticket is open to everyone.');
  };

  const addCode = async () => {
    const code = normalizeCodeInput(draft);
    const problem = codeInputProblem(code);
    if (problem) { toast(problem, 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${base}/codes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error || 'Could not add code', 'error'); return; }
      setCodes(c => [...(c ?? []), d.data]);
      setDraft('');
      toast(`${code} added`, 'success');
    } finally { setBusy(false); }
  };

  const setCodeActive = async (c: Code, active: boolean) => {
    setCodes(list => list?.map(x => x.id === c.id ? { ...x, active } : x) ?? list);
    const res = await fetch(`${base}/codes/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
    if (!res.ok) {
      setCodes(list => list?.map(x => x.id === c.id ? { ...x, active: !active } : x) ?? list);
      toast('Could not update the code', 'error');
      return;
    }
    toast(active ? `${c.code} is on again` : `${c.code} switched off. It no longer unlocks this ticket.`, 'success');
  };

  const toggleDomains = (on: boolean) => {
    setDomainsOn(on);
    if (!on && savedDomains) patchTier({ allowed_email_domains: [] }, 'Email restriction removed from this ticket');
  };
  const saveDomains = () => {
    const list = domainsInput.split(',').map(d => d.trim()).filter(Boolean);
    if (!list.length) { toast('Enter at least one domain, or switch this off', 'error'); return; }
    patchTier({ allowed_email_domains: list }, 'Saved. Only those email addresses can buy this ticket.');
  };

  const activeCount = codes?.filter(c => c.active).length ?? 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Who can buy &ldquo;{tier.name}&rdquo;?</p>

      <GateToggleRow icon="code" title="Promo code ticket" summary="Buyers need a code from you to buy it."
        info={PROMO_INFO} checked={!!tier.requires_code} onChange={togglePromo} disabled={busy}>
        {tier.requires_code && codes !== null && activeCount === 0 && (
          <p className="text-xs flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={13} />No active codes, so nobody can buy this ticket right now. Add or switch on a code.
          </p>
        )}
        {codes === null ? (
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Loading codes...</p>
        ) : codes.length > 0 && (
          <div className="flex flex-col divide-y rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
            {codes.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                <div className="min-w-0">
                  <span className="font-mono text-sm tracking-wider" style={{ color: c.active ? 'var(--color-text)' : 'var(--color-text-dim)', textDecoration: c.active ? 'none' : 'line-through' }}>{c.code}</span>
                  <span className="text-xs ml-2" style={{ color: 'var(--color-text-dim)' }}>
                    {c.ticketsSold} sold{c.active ? '' : ' · off'}
                  </span>
                </div>
                <Switch checked={c.active} onChange={v => setCodeActive(c, v)} label={`${c.code} on or off`} />
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={draft} maxLength={8} placeholder="New code, e.g. MTNVIP"
            onChange={e => setDraft(normalizeCodeInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCode(); } }}
            className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm font-mono tracking-wider outline-none"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          <button type="button" onClick={addCode} disabled={busy || !draft}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}>
            <Plus size={14} />Add
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{CODE_RULES}</p>
      </GateToggleRow>

      <GateToggleRow icon="email" title="Only certain email addresses" summary="Limit this ticket to emails at domains you choose."
        info={DOMAIN_INFO} checked={domainsOn} onChange={toggleDomains} disabled={busy}>
        <div className="flex gap-2">
          <input value={domainsInput} onChange={e => setDomainsInput(e.target.value)} placeholder="e.g. mtn.com, unilag.edu.ng"
            className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          <button type="button" onClick={saveDomains} disabled={busy || domainsInput.trim() === savedDomains}
            className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}>
            Save
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Comma-separated. No @ needed.</p>
        {domainConflict(eventDomains, parseDomainList(domainsInput)) && <DomainConflictWarning eventDomains={eventDomains ?? []} />}
      </GateToggleRow>
    </div>
  );
}
