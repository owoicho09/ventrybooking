'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Socials } from '@/components/organizer/SocialLinks';
import { useSecureChange } from '@/components/organizer/SecureChange';
import { TrustedDevicesPanel } from '@/components/organizer/TrustedDevicesPanel';

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
  bank_name: string; account_number: string; account_name: string; legal_name: string;
  email_notifications: boolean; sms_alerts: boolean;
  handle: string; avatar_url: string | null; cover_image_url: string | null; socials: Socials;
}

export default function OrganizerSettingsPage() {
  const router = useRouter();

  const [me, setMe]                   = useState<Partial<Me>>({});
  const [storefrontSaving, setStorefrontSaving] = useState(false);
  const [storefrontMsg, setStorefrontMsg]       = useState('');
  const [avatarUploading, setAvatarUploading]   = useState(false);
  const [coverUploading, setCoverUploading]     = useState(false);
  const [shareCopied, setShareCopied]           = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwSaving, setPwSaving]       = useState(false);
  const [profileMsg, setProfileMsg]   = useState('');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg]       = useState('');
  const [pwMsg, setPwMsg]             = useState('');
  const [pw, setPw]                   = useState({ current: '', newPw: '', confirm: '' });
  // Email change (055): confirm current inbox (grant), then a code to the new one.
  const [emailEditing, setEmailEditing] = useState(false);
  const [newEmail, setNewEmail]         = useState('');
  const [emailCodeSentTo, setEmailCodeSentTo] = useState<string | null>(null);
  const [emailCode, setEmailCode]       = useState('');
  const [emailBusy, setEmailBusy]       = useState(false);
  const [emailMsg, setEmailMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const { secure, secureModal } = useSecureChange();
  const json = (headers: Record<string, string>) => ({ ...headers, 'Content-Type': 'application/json' });
  const [deleteOpen,     setDeleteOpen]     = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError,    setDeleteError]    = useState('');
  const [deleting,       setDeleting]       = useState(false);

  useEffect(() => {
    fetch('/api/organizer/me')
      .then(r => r.json())
      .then(d => { if (d.success) setMe(d.data); })
      .catch(console.error);
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true); setProfileMsg('');
    try {
      const res = await secure(h => fetch('/api/organizer/settings', {
        method: 'PATCH',
        headers: json(h),
        body: JSON.stringify({ name: me.name, phone: me.phone, bio: me.bio }),
      }));
      if (!res) return;
      const d = await res.json();
      setProfileMsg(d.success ? 'Profile saved.' : (d.error ?? 'Failed to save profile'));
    } finally { setProfileSaving(false); }
  };

  const sendNewEmailCode = async () => {
    setEmailBusy(true); setEmailMsg(null);
    try {
      const res = await secure(h => fetch('/api/organizer/settings/email', {
        method: 'POST', headers: json(h), body: JSON.stringify({ newEmail }),
      }));
      if (!res) return;
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setEmailMsg({ ok: false, text: d.error ?? 'Could not send the code' }); return; }
      setEmailCodeSentTo(d.data.sentTo);
      setEmailCode('');
    } finally { setEmailBusy(false); }
  };

  const confirmNewEmail = async () => {
    setEmailBusy(true); setEmailMsg(null);
    try {
      const res = await secure(h => fetch('/api/organizer/settings/email/confirm', {
        method: 'POST', headers: json(h), body: JSON.stringify({ code: emailCode }),
      }));
      if (!res) return;
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setEmailMsg({ ok: false, text: d.error ?? 'Could not change your email' }); return; }
      setMe(p => ({ ...p, email: d.data.email }));
      setEmailEditing(false); setNewEmail(''); setEmailCodeSentTo(null); setEmailCode('');
      setEmailMsg({ ok: true, text: `Email changed. Sign in with ${d.data.email} from now on.` });
    } finally { setEmailBusy(false); }
  };

  const cancelEmailChange = () => {
    setEmailEditing(false); setNewEmail(''); setEmailCodeSentTo(null); setEmailCode(''); setEmailMsg(null);
  };

  const saveStorefront = async (e: React.FormEvent) => {
    e.preventDefault();
    setStorefrontSaving(true); setStorefrontMsg('');
    try {
      const res = await secure(h => fetch('/api/organizer/settings', {
        method: 'PATCH',
        headers: json(h),
        body: JSON.stringify({ handle: me.handle, socials: me.socials || {} }),
      }));
      if (!res) return;
      const d = await res.json();
      setStorefrontMsg(d.success ? 'Storefront saved.' : (d.error ?? 'Failed to save'));
      if (d.success && me.handle) setMe(p => ({ ...p, handle: d.data?.handle ?? p.handle }));
    } finally { setStorefrontSaving(false); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAvatarUploading(true);
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await secure(h => fetch('/api/organizer/avatar', { method: 'POST', headers: h, body: fd })).finally(() => setAvatarUploading(false));
    if (!res) return;
    const d = await res.json();
    if (!res.ok) { setStorefrontMsg(d.error || 'Avatar upload failed'); return; }
    setMe(p => ({ ...p, avatar_url: d.data.avatarUrl }));
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCoverUploading(true);
    const fd = new FormData();
    fd.append('cover', file);
    const res = await secure(h => fetch('/api/organizer/cover', { method: 'POST', headers: h, body: fd })).finally(() => setCoverUploading(false));
    if (!res) return;
    const d = await res.json();
    if (!res.ok) { setStorefrontMsg(d.error || 'Cover image upload failed'); return; }
    setMe(p => ({ ...p, cover_image_url: d.data.coverImageUrl }));
  };

  const setSocial = (platform: keyof Socials) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMe(p => ({ ...p, socials: { ...p.socials, [platform]: e.target.value } }));

  const handleShareProfile = async () => {
    if (!me.handle) return;
    const url = `${window.location.origin}/${me.handle}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: me.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // user cancelled the share sheet, or clipboard unavailable — no toast needed
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPw !== pw.confirm) { setPwMsg('New passwords do not match'); return; }
    if (pw.newPw.length < 8)    { setPwMsg('Password must be at least 8 characters'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      const res = await secure(h => fetch('/api/auth/change-password', {
        method: 'POST',
        headers: json(h),
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.newPw }),
      }));
      if (!res) return;
      const d = await res.json();
      setPwMsg(d.success ? 'Password changed successfully.' : (d.error ?? 'Failed to change password'));
      if (d.success) setPw({ current: '', newPw: '', confirm: '' });
    } finally { setPwSaving(false); }
  };

  const set = (field: keyof Me) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setMe(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h1 className="text-2xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
        Settings
      </h1>
      <p className="text-sm -mt-5 flex items-start gap-2" style={{ color: 'var(--color-text-muted)' }}>
        <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-purple-light)' }} />
        For your security, saving any change here asks for a code we email you. One code covers 10 minutes of changes.
      </p>

      {/* Profile */}
      <section className="rounded-xl border p-6 flex flex-col gap-5"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Profile</h2>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <Input
            label="Display name"
            value={me.name || ''}
            onChange={set('name')}
            helper="What buyers see on your events, tickets and profile. Your legal name, used for verification and payouts, is under Bank Details below."
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <div className="flex-1"><Input label="Email" type="email" value={me.email || ''} disabled /></div>
              {!emailEditing && (
                <Button type="button" variant="outline" onClick={() => { setEmailEditing(true); setEmailMsg(null); }}>Change</Button>
              )}
            </div>
            {emailEditing && (
              <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                {!emailCodeSentTo ? (
                  <>
                    <Input label="New email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="you@newaddress.com" />
                    <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                      We&apos;ll confirm it&apos;s you with a code to your current email, then send a second code to the new one.
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" disabled={emailBusy || !newEmail.trim()} onClick={sendNewEmailCode}>{emailBusy ? 'Sending…' : 'Send code to new email'}</Button>
                      <Button type="button" variant="outline" disabled={emailBusy} onClick={cancelEmailChange}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Enter the 6-digit code we sent to <strong style={{ color: 'var(--color-text)' }}>{emailCodeSentTo}</strong>.
                    </p>
                    <input value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric" autoComplete="one-time-code" placeholder="000000" aria-label="Code from your new email"
                      className="w-full rounded-lg border px-3 py-2.5 text-center text-xl font-mono tracking-[0.4em] outline-none"
                      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                    <div className="flex gap-2 flex-wrap">
                      <Button type="button" disabled={emailBusy || emailCode.length !== 6} onClick={confirmNewEmail}>{emailBusy ? 'Confirming…' : 'Confirm new email'}</Button>
                      <Button type="button" variant="outline" disabled={emailBusy} onClick={sendNewEmailCode}>Resend</Button>
                      <Button type="button" variant="outline" disabled={emailBusy} onClick={cancelEmailChange}>Cancel</Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {emailMsg && (
              <p className="text-xs" style={{ color: emailMsg.ok ? 'var(--color-green)' : 'var(--color-red)' }}>{emailMsg.text}</p>
            )}
          </div>
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

      {/* Storefront */}
      <section className="rounded-xl border p-6 flex flex-col gap-5"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Storefront</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
              Your public page at ventrybooking.com/{me.handle || 'yourhandle'}
            </p>
          </div>
          {me.handle && (
            <button
              type="button"
              onClick={handleShareProfile}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1.5 flex-shrink-0"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <Copy size={12} />{shareCopied ? 'Copied!' : 'Copy Profile Link'}
            </button>
          )}
        </div>
        <form onSubmit={saveStorefront} className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>Cover Image</p>
            <div className="w-full h-28 rounded-lg overflow-hidden mb-2" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              {me.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
              )}
            </div>
            <label className="text-sm font-medium px-4 py-2 rounded-lg border cursor-pointer inline-block"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <input type="file" accept="image/*" className="sr-only" onChange={handleCoverChange} disabled={coverUploading} />
              {coverUploading ? 'Uploading…' : me.cover_image_url ? 'Change Cover Image' : 'Add Cover Image'}
            </label>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: 'var(--color-purple)' }}>
              {me.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={me.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                : (me.name?.[0] || '?')}
            </div>
            <label className="text-sm font-medium px-4 py-2 rounded-lg border cursor-pointer"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} disabled={avatarUploading} />
              {avatarUploading ? 'Uploading…' : 'Change Avatar'}
            </label>
          </div>
          <Input
            label="Handle"
            value={me.handle || ''}
            onChange={e => setMe(p => ({ ...p, handle: e.target.value }))}
            placeholder="yourhandle"
            helper="Lowercase letters, numbers, and hyphens only."
          />
          <Input label="Instagram" value={me.socials?.instagram || ''} onChange={setSocial('instagram')} placeholder="https://instagram.com/yourname" />
          <Input label="X" value={me.socials?.twitter || ''} onChange={setSocial('twitter')} placeholder="https://x.com/yourname" />
          <Input label="TikTok" value={me.socials?.tiktok || ''} onChange={setSocial('tiktok')} placeholder="https://tiktok.com/@yourname" />
          <Input label="Snapchat" value={me.socials?.snapchat || ''} onChange={setSocial('snapchat')} placeholder="https://snapchat.com/add/yourname" />
          <Input label="WhatsApp" value={me.socials?.whatsapp || ''} onChange={setSocial('whatsapp')} placeholder="2348012345678" helper="Include the country code, digits only." />
          {storefrontMsg && (
            <p className="text-xs" style={{ color: storefrontMsg.includes('saved') ? 'var(--color-green)' : 'var(--color-red)' }}>
              {storefrontMsg}
            </p>
          )}
          <Button type="submit" disabled={storefrontSaving}>{storefrontSaving ? 'Saving…' : 'Save Storefront'}</Button>
        </form>
      </section>

      {/* Bank Details: managed on the Payouts page, where account changes need
          your password plus an emailed code (Organiser Terms 3.8). */}
      <section className="rounded-xl border p-6 flex flex-col gap-5"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Bank Details</h2>
          <Link href="/organizer/payouts" className="text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
            {me.account_number ? 'Change on Payouts' : 'Add on Payouts'}
          </Link>
        </div>
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
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>Legal Name</span>
            <span style={{ color: 'var(--color-text)' }}>{me.legal_name || '—'}</span>
          </div>
        </div>
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
        {notifMsg && (
          <p className="text-xs" style={{ color: notifMsg.includes('saved') ? 'var(--color-green)' : 'var(--color-red)' }}>{notifMsg}</p>
        )}
        <Button
          onClick={async () => {
            setNotifSaving(true); setNotifMsg('');
            try {
              const res = await secure(h => fetch('/api/organizer/settings', {
                method: 'PATCH',
                headers: json(h),
                body: JSON.stringify({ email_notifications: me.email_notifications, sms_alerts: me.sms_alerts }),
              }));
              if (!res) return;
              const d = await res.json();
              setNotifMsg(d.success ? 'Preferences saved.' : (d.error ?? 'Failed to save'));
            } finally { setNotifSaving(false); }
          }}
          disabled={notifSaving}
        >
          {notifSaving ? 'Saving…' : 'Save Notification Preferences'}
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
        <div className="pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <TrustedDevicesPanel secure={secure} />
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#ef444408', borderColor: '#ef444430' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-red)' }}>Danger Zone</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Permanently delete your organizer account and all associated data. This cannot be undone.
        </p>
        <Button variant="danger" className="self-start" onClick={() => { setDeleteOpen(true); setDeletePassword(''); setDeleteError(''); }}>
          Delete Account
        </Button>
      </section>

      {/* Delete confirmation modal */}
      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Delete Account">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            This will permanently delete your account, profile, and all event data. You cannot undo this.
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Enter your password to confirm:
          </p>
          <Input
            label="Password"
            type="password"
            value={deletePassword}
            onChange={e => setDeletePassword(e.target.value)}
            placeholder="Your current password"
          />
          {deleteError && (
            <p className="text-sm" style={{ color: 'var(--color-red)' }}>{deleteError}</p>
          )}
          <div className="flex gap-3 pt-1">
            <Button
              variant="danger"
              disabled={deleting || !deletePassword}
              onClick={async () => {
                setDeleting(true);
                setDeleteError('');
                try {
                  const res = await secure(h => fetch('/api/organizer/account', {
                    method: 'DELETE',
                    headers: json(h),
                    body: JSON.stringify({ password: deletePassword }),
                  }));
                  if (!res) { setDeleting(false); return; }
                  const data = await res.json();
                  if (!res.ok) {
                    setDeleteError(data.error ?? 'Failed to delete account');
                    setDeleting(false);
                    return;
                  }
                  router.push('/organizer/login');
                } catch {
                  setDeleteError('Network error — please try again');
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting…' : 'Yes, delete my account'}
            </Button>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
      {secureModal}
    </div>
  );
}
