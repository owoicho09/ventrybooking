'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { NIGERIAN_BANKS } from '@/lib/banks';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={onChange}
      className="relative rounded-full transition-colors flex-shrink-0"
      style={{ backgroundColor: checked ? 'var(--color-purple)' : 'var(--color-border)', width: 40, height: 22 }}>
      <span className="absolute top-0.5 transition-all rounded-full bg-white"
        style={{ width: 18, height: 18, left: checked ? 20 : 2 }} />
    </button>
  );
}

interface Me {
  name: string; email: string; phone: string; bio: string;
  bank_name: string; account_number: string; account_name: string;
  email_notifications: boolean; sms_alerts: boolean;
}

export default function OrganizerSettingsPage() {
  const [me, setMe]                   = useState<Partial<Me>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [bankSaving, setBankSaving]   = useState(false);
  const [pwSaving, setPwSaving]       = useState(false);
  const [profileMsg, setProfileMsg]   = useState('');
  const [bankMsg, setBankMsg]         = useState('');
  const [pwMsg, setPwMsg]             = useState('');
  const [pw, setPw]                   = useState({ current: '', newPw: '', confirm: '' });
  const [editingBank, setEditingBank] = useState(false);

  useEffect(() => {
    fetch('/api/organizer/me')
      .then(r => r.json())
      .then(d => { if (d.success) setMe(d.data); })
      .catch(console.error);
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true); setProfileMsg('');
    const res = await fetch('/api/organizer/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: me.name, phone: me.phone, bio: me.bio, email_notifications: me.email_notifications, sms_alerts: me.sms_alerts }),
    });
    const d = await res.json();
    setProfileMsg(d.success ? 'Profile saved.' : d.error);
    setProfileSaving(false);
  };

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankSaving(true); setBankMsg('');
    const res = await fetch('/api/organizer/bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName: me.bank_name,
        accountNumber: me.account_number,
        accountName: me.account_name,
      }),
    });
    const d = await res.json();
    setBankMsg(d.success ? 'Bank details saved.' : d.error);
    setBankSaving(false);
    if (d.success) setEditingBank(false);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPw !== pw.confirm) { setPwMsg('New passwords do not match'); return; }
    if (pw.newPw.length < 8)    { setPwMsg('Password must be at least 8 characters'); return; }
    setPwSaving(true); setPwMsg('');
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.newPw }),
    });
    const d = await res.json();
    setPwMsg(d.success ? 'Password changed successfully.' : d.error);
    setPwSaving(false);
    if (d.success) setPw({ current: '', newPw: '', confirm: '' });
  };

  const set = (field: keyof Me) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setMe(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h1 className="text-2xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        Settings
      </h1>

      {/* Profile */}
      <section className="rounded-xl border p-6 flex flex-col gap-5"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Profile</h2>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <Input label="Full Name" value={me.name || ''} onChange={set('name')} />
          <Input label="Email" type="email" value={me.email || ''} disabled />
          <Input label="Phone Number" type="tel" value={me.phone || ''} onChange={set('phone')} />
          <Textarea label="Bio" value={me.bio || ''} onChange={set('bio')} placeholder="Tell attendees about yourself…" rows={3} />
          {profileMsg && (
            <p className="text-xs" style={{ color: profileMsg.includes('saved') ? 'var(--color-green)' : 'var(--color-red)' }}>
              {profileMsg}
            </p>
          )}
          <Button type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save Profile'}</Button>
        </form>
      </section>

      {/* Bank Details */}
      <section className="rounded-xl border p-6 flex flex-col gap-5"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Bank Details</h2>
          <button onClick={() => setEditingBank(!editingBank)} className="text-sm font-medium"
            style={{ color: 'var(--color-purple-light)' }}>
            {editingBank ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {!editingBank ? (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-muted)' }}>Bank</span>
              <span style={{ color: 'var(--color-text)' }}>{me.bank_name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-muted)' }}>Account</span>
              <span className="font-mono" style={{ color: 'var(--color-text)' }}>
                {me.account_number ? `****${me.account_number.slice(-4)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-muted)' }}>Account Name</span>
              <span style={{ color: 'var(--color-text)' }}>{me.account_name || '—'}</span>
            </div>
          </div>
        ) : (
          <form onSubmit={saveBank} className="flex flex-col gap-4">
            {/* Bank selector — maps to the correct Paystack bank_code */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Bank</label>
              <select
                value={me.bank_name || ''}
                onChange={set('bank_name')}
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
              value={me.account_number || ''}
              onChange={set('account_number')}
              placeholder="10-digit account number"
              maxLength={10}
            />
            <Input
              label="Account Name (as on bank account)"
              value={me.account_name || ''}
              onChange={set('account_name')}
              placeholder="Exact name as registered with the bank"
            />
            {bankMsg && (
              <p className="text-xs" style={{ color: bankMsg.includes('saved') ? 'var(--color-green)' : 'var(--color-red)' }}>
                {bankMsg}
              </p>
            )}
            <Button type="submit" disabled={bankSaving}>{bankSaving ? 'Saving…' : 'Save Bank Details'}</Button>
          </form>
        )}
      </section>

      {/* Notifications */}
      <section className="rounded-xl border p-6 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Notifications</h2>
        {([
          { label: 'Email notifications', sub: 'New ticket purchases, refund claims, event updates', field: 'email_notifications' as const },
          { label: 'SMS alerts',          sub: 'Critical alerts only — event approvals and payouts',  field: 'sms_alerts' as const },
        ]).map(({ label, sub, field }) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
            </div>
            <Toggle checked={!!me[field]} onChange={() => setMe(p => ({ ...p, [field]: !p[field] }))} />
          </div>
        ))}
        <Button
          onClick={(e: React.MouseEvent) => { e.preventDefault(); saveProfile(new Event('submit') as unknown as React.FormEvent); }}
          disabled={profileSaving}
        >
          Save Notification Preferences
        </Button>
      </section>

      {/* Security */}
      <section className="rounded-xl border p-6 flex flex-col gap-5"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Security</h2>
        <form onSubmit={changePassword} className="flex flex-col gap-4">
          <Input label="Current Password" type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} placeholder="Enter current password" />
          <Input label="New Password (8+ characters)" type="password" value={pw.newPw} onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))} placeholder="Enter new password" />
          <Input label="Confirm New Password" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" />
          {pwMsg && (
            <p className="text-xs" style={{ color: pwMsg.includes('successfully') ? 'var(--color-green)' : 'var(--color-red)' }}>
              {pwMsg}
            </p>
          )}
          <Button type="submit" disabled={pwSaving}>{pwSaving ? 'Changing…' : 'Change Password'}</Button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#ef444408', borderColor: '#ef444430' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-red)' }}>Danger Zone</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Permanently delete your organizer account. This cannot be undone.
        </p>
        <Button variant="danger" className="self-start">Delete Account</Button>
      </section>
    </div>
  );
}
