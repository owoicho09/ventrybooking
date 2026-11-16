'use client';

import { useState } from 'react';
import { Info, KeyRound, Mail, X, Plus, AlertTriangle } from 'lucide-react';

/**
 * Gated-tier controls (054), shared by the create form, the add-tier form
 * and the per-tier access panel. Both gates are optional and independent:
 * a tier can be open, code-only, email-domain-only, or need both.
 */

export const CODE_RULES = '4–8 letters or numbers. Not case-sensitive, so VIP2026 and vip2026 are the same code.';

export const PROMO_INFO = (
  <>
    <p>Only buyers who enter one of your codes can buy this ticket. Everyone else sees it on your event page, marked
      <strong> Promo code</strong>, but can&apos;t select it.</p>
    <p>Good for VIP lists, sponsors&apos; guests, early access or staff tickets. Give each group its own code so you can see who
      sold what, and switch any code off at any time.</p>
    <p>{CODE_RULES} Longer codes (6+) are harder to guess.</p>
  </>
);

export const DOMAIN_INFO = (
  <>
    <p>Only buyers whose email ends in one of these domains can buy this ticket, for example
      <strong> @mtn.com</strong> for a sponsor&apos;s staff or <strong>@unilag.edu.ng</strong> for students.</p>
    <p>Buyers confirm their email with a code before paying, so nobody can fake an address.</p>
    <p>This is for one ticket type. To restrict your <em>whole</em> event, use &ldquo;Restrict to Email Domains&rdquo; in Event Details.</p>
  </>
);

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
      style={{ backgroundColor: checked ? 'var(--color-purple)' : 'var(--color-border)', width: 40, height: 22 }}>
      <span className="absolute top-0.5 transition-all rounded-full bg-white"
        style={{ width: 18, height: 18, left: checked ? 20 : 2 }} />
    </button>
  );
}

/** A toggle with a title, one-line summary and an info icon that drops down an explanation. */
export function GateToggleRow({ icon, title, summary, info, checked, onChange, disabled, children }: {
  icon: 'code' | 'email';
  title: string;
  summary: string;
  info: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Icon = icon === 'code' ? KeyRound : Mail;
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-3"
      style={{ borderColor: checked ? 'var(--color-purple)' : 'var(--color-border)', backgroundColor: checked ? 'rgba(168,85,247,.06)' : 'transparent' }}>
      <div className="flex items-start gap-3">
        <Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: checked ? 'var(--color-purple-light)' : 'var(--color-text-dim)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{title}</span>
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`What is ${title.toLowerCase()}?`}
              className="inline-flex items-center justify-center rounded-full w-5 h-5"
              style={{ color: open ? 'var(--color-purple-light)' : 'var(--color-text-dim)' }}>
              <Info size={14} />
            </button>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>{summary}</p>
        </div>
        <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
      </div>
      {open && (
        <div className="text-xs leading-relaxed flex flex-col gap-1.5 rounded-md p-3"
          style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
          {info}
        </div>
      )}
      {checked && children}
    </div>
  );
}

/** Same normalising the server does: lowercase, no leading @, no blanks. */
export function parseDomainList(raw: string | string[] | null | undefined): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  return Array.from(new Set(list.map(d => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean)));
}

/**
 * The event-wide gate and a tier's gate both apply. If they share no domain,
 * no email can pass both, so nobody can ever buy the tier.
 */
export function domainConflict(eventDomains: string[] | null | undefined, tierDomains: string[] | null | undefined): boolean {
  const ev = parseDomainList(eventDomains ?? []);
  const tier = parseDomainList(tierDomains ?? []);
  return ev.length > 0 && tier.length > 0 && !tier.some(d => ev.includes(d));
}

export function DomainConflictWarning({ eventDomains, tierName }: { eventDomains: string[]; tierName?: string }) {
  return (
    <p className="text-xs flex items-start gap-1.5 rounded-md p-2" role="alert"
      style={{ color: '#f59e0b', backgroundColor: '#f59e0b14', border: '1px solid #f59e0b40' }}>
      <AlertTriangle size={13} className="flex-shrink-0 mt-px" />
      <span>
        Nobody can buy {tierName ? `“${tierName}”` : 'this ticket'}: your whole event is limited to{' '}
        {parseDomainList(eventDomains).map(d => `@${d}`).join(' or ')} emails, and none of this ticket&apos;s domains are on that list.
        Add one of the event&apos;s domains here, or change the event-wide restriction in Event Details.
      </span>
    </p>
  );
}

/** Client-side mirror of the server rule, for instant feedback only. */
export function normalizeCodeInput(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}
export function codeInputProblem(code: string): string | null {
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return 'Use 4–8 letters or numbers (no spaces or symbols)';
  return null;
}

/** Text box + Add button that turns typed codes into a chip list. */
export function CodeChipsInput({ codes, onChange }: { codes: string[]; onChange: (codes: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const code = normalizeCodeInput(draft);
    if (!code) return;
    const problem = codeInputProblem(code);
    if (problem) { setErr(problem); return; }
    if (codes.includes(code)) { setErr(`${code} is already added`); return; }
    onChange([...codes, code]);
    setDraft(''); setErr('');
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input value={draft} maxLength={8} placeholder="e.g. VIP2026"
          onChange={e => { setDraft(normalizeCodeInput(e.target.value)); setErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm font-mono tracking-wider outline-none"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: err ? 'var(--color-red)' : 'var(--color-border)', color: 'var(--color-text)' }} />
        <button type="button" onClick={add}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}>
          <Plus size={14} />Add code
        </button>
      </div>
      {err && <p className="text-xs" style={{ color: 'var(--color-red)' }}>{err}</p>}
      {codes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {codes.map(c => (
            <span key={c} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-mono tracking-wider"
              style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
              {c}
              <button type="button" aria-label={`Remove ${c}`} onClick={() => onChange(codes.filter(x => x !== c))} style={{ color: 'var(--color-text-dim)' }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Add at least one code. {CODE_RULES}</p>
      )}
    </div>
  );
}

export interface TierGateDraft {
  requiresCode: boolean;
  codes: string[];
  domainsOn: boolean;
  domainsInput: string;
}

export const EMPTY_GATES: TierGateDraft = { requiresCode: false, codes: [], domainsOn: false, domainsInput: '' };

/** What gets sent to the API for a draft. */
export function gatesPayload(g: TierGateDraft) {
  return {
    requiresCode: g.requiresCode,
    codes: g.requiresCode ? g.codes : [],
    allowedEmailDomains: g.domainsOn ? g.domainsInput.split(',').map(d => d.trim()).filter(Boolean) : [],
  };
}

/** Problem with a draft that should block submitting, or null. */
export function gatesDraftProblem(g: TierGateDraft, tierName: string): string | null {
  if (g.requiresCode && g.codes.length === 0) return `${tierName || 'A tier'} is a promo code ticket. Add at least one code.`;
  if (g.domainsOn && !g.domainsInput.split(',').some(d => d.trim())) return `${tierName || 'A tier'}: enter at least one email domain, or switch that option off.`;
  return null;
}

/** Both toggles for a tier that doesn't exist yet (create form / add-tier form). */
export function TierGateFields({ value, onChange, eventDomains }: { value: TierGateDraft; onChange: (v: TierGateDraft) => void; eventDomains?: string[] }) {
  const conflict = value.domainsOn && domainConflict(eventDomains, parseDomainList(value.domainsInput));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Who can buy this ticket? <span style={{ color: 'var(--color-text-dim)' }}>(optional, leave both off for a normal ticket)</span></p>
      <GateToggleRow icon="code" title="Promo code ticket" summary="Buyers need a code from you to buy it."
        info={PROMO_INFO} checked={value.requiresCode} onChange={v => onChange({ ...value, requiresCode: v })}>
        <CodeChipsInput codes={value.codes} onChange={codes => onChange({ ...value, codes })} />
      </GateToggleRow>
      <GateToggleRow icon="email" title="Only certain email addresses" summary="Limit this ticket to emails at domains you choose."
        info={DOMAIN_INFO} checked={value.domainsOn} onChange={v => onChange({ ...value, domainsOn: v })}>
        <input value={value.domainsInput} onChange={e => onChange({ ...value, domainsInput: e.target.value })}
          placeholder="e.g. mtn.com, unilag.edu.ng"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Comma-separated. No @ needed.</p>
        {conflict && <DomainConflictWarning eventDomains={eventDomains ?? []} />}
      </GateToggleRow>
    </div>
  );
}
