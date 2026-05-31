'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, Info, CheckCircle, Phone, Globe, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const steps = [
  { n: 1, label: 'Identity' },
  { n: 2, label: 'Phone' },
  { n: 3, label: 'Social' },
  { n: 4, label: 'Venue' },
  { n: 5, label: 'Review' },
];

function UploadArea({ label, sub, accept, onChange }: { label: string; sub: string; accept: string; onChange: (f: File | null) => void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <label className="block rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors hover:border-[var(--color-purple)]"
      style={{ borderColor: 'var(--color-border)' }}>
      <input type="file" className="sr-only" accept={accept} onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        setFile(f);
        onChange(f);
      }} />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle size={28} style={{ color: 'var(--color-green)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-green)' }}>{file.name}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Click to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}>
            <Upload size={20} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Drag & drop or click &middot; JPG, PNG, PDF max 5MB</p>
        </div>
      )}
    </label>
  );
}

export default function KYCVerifyPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(1);

  // Redirect organizers who are already verified away from the KYC page
  useEffect(() => {
    fetch('/api/organizer/me')
      .then(r => r.json())
      .then(d => {
        if (d.data?.verified === true) router.replace('/organizer/dashboard');
      })
      .catch(() => { /* non-critical */ });
  }, [router]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [govId, setGovId] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [phone, setPhone] = useState('');
  const [social, setSocial] = useState({ twitter: '', instagram: '', facebook: '' });
  const [venueProof, setVenueProof] = useState<File | null>(null);

  const submitStep = async (formData: FormData) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/organizer/kyc', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Submission failed'); return false; }
      return true;
    } catch { setError('Network error. Please try again.'); return false; }
    finally { setLoading(false); }
  };

  const handleStep1 = async () => {
    if (!govId || !selfie) { setError('Both files are required'); return; }
    const fd = new FormData();
    fd.append('step', '1');
    fd.append('governmentId', govId);
    fd.append('selfie', selfie);
    if (await submitStep(fd)) setActiveStep(2);
  };

  const handleStep2 = async () => {
    if (!phone) { setError('Phone number required'); return; }
    const fd = new FormData();
    fd.append('step', '2');
    fd.append('phone', phone);
    if (await submitStep(fd)) setActiveStep(3);
  };

  const handleStep3 = async () => {
    const fd = new FormData();
    fd.append('step', '3');
    fd.append('twitter', social.twitter);
    fd.append('instagram', social.instagram);
    fd.append('facebook', social.facebook);
    if (await submitStep(fd)) setActiveStep(4);
  };

  const handleStep4 = async () => {
    if (!venueProof) { setError('Venue proof document required'); return; }
    const fd = new FormData();
    fd.append('step', '4');
    fd.append('venueProof', venueProof);
    if (await submitStep(fd)) setActiveStep(5);
  };

  const handleStep5 = async () => {
    const fd = new FormData();
    fd.append('step', '5');
    if (await submitStep(fd)) router.push('/organizer/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="border-b h-16 flex items-center px-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <Link href="/" className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
          <span style={{ color: 'var(--color-purple)' }}>V</span>
          <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-10">
            {steps.map((step, i) => {
              const active = step.n === activeStep;
              const done = step.n < activeStep;
              return (
                <div key={step.n} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="flex items-center w-full">
                    {i > 0 && <div className="flex-1 h-0.5" style={{ backgroundColor: done ? 'var(--color-purple)' : 'var(--color-border)' }} />}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: done ? 'var(--color-purple)' : active ? 'var(--color-purple-dim)' : 'var(--color-surface-2)', color: done || active ? (done ? '#fff' : 'var(--color-purple)') : 'var(--color-text-dim)', border: active ? '2px solid var(--color-purple)' : '2px solid transparent' }}>
                      {done ? <CheckCircle size={14} /> : step.n}
                    </div>
                    {i < steps.length - 1 && <div className="flex-1 h-0.5" style={{ backgroundColor: done ? 'var(--color-purple)' : 'var(--color-border)' }} />}
                  </div>
                  <p className="text-[10px]" style={{ color: active ? 'var(--color-purple-light)' : 'var(--color-text-dim)' }}>{step.label}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {error && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm border" style={{ backgroundColor: '#ef444415', borderColor: '#ef444430', color: 'var(--color-red)' }}>
                {error}
              </div>
            )}

            {activeStep === 1 && (
              <>
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Identity Verification</h1>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Upload your government-issued ID and a selfie holding the document.</p>
                <div className="flex flex-col gap-4 mb-6">
                  <UploadArea label="Upload Government ID" sub="NIN Slip, Driver's Licence, or International Passport" accept="image/*,.pdf" onChange={setGovId} />
                  <UploadArea label="Upload Selfie Holding ID" sub="Hold your ID next to your face. No sunglasses." accept="image/*" onChange={setSelfie} />
                </div>
                <div className="rounded-lg px-4 py-3 flex items-start gap-3 mb-6 text-sm" style={{ backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30' }}>
                  <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-amber)' }} />
                  <p style={{ color: 'var(--color-text-muted)' }}>Documents reviewed within <strong style={{ color: 'var(--color-text)' }}>2-4 business days</strong>.</p>
                </div>
                <Button size="lg" fullWidth onClick={handleStep1} disabled={loading}>{loading ? 'Uploading...' : 'Continue'}</Button>
              </>
            )}

            {activeStep === 2 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Phone size={22} style={{ color: 'var(--color-purple)' }} />
                  <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Phone Verification</h1>
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Confirm your Nigerian phone number for account security.</p>
                <Input label="Phone Number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 801 234 5678" />
                <Button size="lg" fullWidth onClick={handleStep2} disabled={loading} className="mt-6">{loading ? 'Saving...' : 'Continue'}</Button>
              </>
            )}

            {activeStep === 3 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Globe size={22} style={{ color: 'var(--color-purple)' }} />
                  <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Social Presence</h1>
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>At least one social profile helps verify your legitimacy as an organizer.</p>
                <div className="flex flex-col gap-4">
                  <Input label="Twitter / X handle" placeholder="@yourhandle" value={social.twitter} onChange={(e) => setSocial(s => ({ ...s, twitter: e.target.value }))} />
                  <Input label="Instagram handle" placeholder="@yourhandle" value={social.instagram} onChange={(e) => setSocial(s => ({ ...s, instagram: e.target.value }))} />
                  <Input label="Facebook page URL" placeholder="facebook.com/yourpage" value={social.facebook} onChange={(e) => setSocial(s => ({ ...s, facebook: e.target.value }))} />
                </div>
                <Button size="lg" fullWidth onClick={handleStep3} disabled={loading} className="mt-6">{loading ? 'Saving...' : 'Continue'}</Button>
              </>
            )}

            {activeStep === 4 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <FileText size={22} style={{ color: 'var(--color-purple)' }} />
                  <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Venue Proof</h1>
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Upload a venue booking confirmation or rental agreement for your first event.</p>
                <UploadArea label="Upload Venue Proof Document" sub="Booking confirmation, rental agreement, or permit" accept=".pdf,image/*" onChange={setVenueProof} />
                <Button size="lg" fullWidth onClick={handleStep4} disabled={loading} className="mt-6">{loading ? 'Uploading...' : 'Continue'}</Button>
              </>
            )}

            {activeStep === 5 && (
              <>
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Review & Submit</h1>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>All steps complete. Submit your KYC for admin review.</p>
                <div className="flex flex-col gap-3 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {['Identity documents', 'Phone verification', 'Social profiles', 'Venue proof'].map((item, i) => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle size={15} style={{ color: 'var(--color-green)' }} />
                      <span>Step {i + 1}: {item} — submitted</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg px-4 py-3 flex items-start gap-3 mb-6 text-sm" style={{ backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30' }}>
                  <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-amber)' }} />
                  <p style={{ color: 'var(--color-text-muted)' }}>Review takes <strong style={{ color: 'var(--color-text)' }}>2-4 business days</strong>. You will be notified by email.</p>
                </div>
                <Button size="lg" fullWidth onClick={handleStep5} disabled={loading}>{loading ? 'Submitting...' : 'Submit KYC for Review'}</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
