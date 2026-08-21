'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, ShoppingBag, Bell, X, ImagePlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { formatShortDate } from '@/lib/utils';

interface Member { id: string; name: string | null; source: string; subscribed_at: string; }
interface NewsletterRow {
  id: string; subject: string; body: string; image_urls: string[]; status: string;
  rejection_reason: string | null; recipient_count: number | null;
  submitted_at: string; reviewed_at: string | null; sent_at: string | null;
}

const MAX_IMAGES = 3;

const sourceBadge = (source: string) =>
  source === 'ticket_consent'
    ? <Badge variant="purple"><ShoppingBag size={11} />Ticket Purchase</Badge>
    : <Badge variant="blue"><Bell size={11} />Notify Me</Badge>;

const statusBadge = (status: string) => {
  switch (status) {
    case 'pending':  return <Badge variant="amber">Pending Review</Badge>;
    case 'approved': return <Badge variant="green">Approved &amp; Sent</Badge>;
    case 'rejected': return <Badge variant="red">Rejected</Badge>;
    default:         return <Badge variant="gray">{status}</Badge>;
  }
};

export default function AudiencePage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers]   = useState<Member[]>([]);
  const [count, setCount]       = useState(0);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [newsletters, setNewsletters] = useState<NewsletterRow[]>([]);
  const [loadingNewsletters, setLoadingNewsletters] = useState(true);

  const [subject, setSubject] = useState('');
  const [body, setBody]       = useState('');
  const [images, setImages]   = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadAudience = () => {
    setLoadingMembers(true);
    fetch('/api/organizer/audience')
      .then(r => r.json())
      .then(d => { if (d.success) { setMembers(d.data.members); setCount(d.data.count); } })
      .catch(console.error)
      .finally(() => setLoadingMembers(false));
  };

  const loadNewsletters = () => {
    setLoadingNewsletters(true);
    fetch('/api/organizer/newsletters')
      .then(r => r.json())
      .then(d => { if (d.success) setNewsletters(d.data); })
      .catch(console.error)
      .finally(() => setLoadingNewsletters(false));
  };

  useEffect(() => { loadAudience(); loadNewsletters(); }, []);

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    setImages(prev => [...prev, ...Array.from(files)].slice(0, MAX_IMAGES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('subject', subject.trim());
      fd.append('body', body.trim());
      images.forEach(img => fd.append('images', img));

      const res = await fetch('/api/organizer/newsletters', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Failed to submit mail', 'error'); return; }
      toast('Submitted for review', 'success');
      setSubject(''); setBody(''); setImages([]);
      loadNewsletters();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          Audience
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Everyone who&apos;s agreed to hear from you — by name only. Ventry holds the email relationship and sends on your behalf.
        </p>
      </div>

      <div className="rounded-xl border p-4 flex items-center gap-3"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}>
          <Users size={18} />
        </div>
        <div>
          <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{count.toLocaleString()}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>people in your audience</p>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Members</h2>
        </div>
        {loadingMembers ? (
          <p className="text-sm p-4" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm p-4" style={{ color: 'var(--color-text-muted)' }}>
            No one yet — people join when they tick the mailing checkbox at checkout or tap Notify Me on your organiser page.
          </p>
        ) : (
          <Table>
            <Thead>
              <tr><Th>Name</Th><Th>Source</Th><Th>Joined</Th></tr>
            </Thead>
            <Tbody>
              {members.map(m => (
                <Tr key={m.id}>
                  <Td><span style={{ color: 'var(--color-text)' }}>{m.name || 'Anonymous'}</span></Td>
                  <Td>{sourceBadge(m.source)}</Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(m.subscribed_at.split('T')[0])}</span></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <div className="rounded-xl border p-5 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Contact Audience</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Compose a mail to your audience. Ventry reviews every submission before it sends — nothing goes out automatically.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. New show announced!" required />
          <Textarea label="Message" value={body} onChange={e => setBody(e.target.value)} placeholder="Write your update…" rows={6} required />

          <div>
            <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>
              Images (optional, up to {MAX_IMAGES})
            </label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="sr-only"
                    onChange={e => handleAddImages(e.target.files)} />
                  <ImagePlus size={18} style={{ color: 'var(--color-text-dim)' }} />
                </label>
              )}
            </div>
          </div>

          <Button type="submit" disabled={submitting || !subject.trim() || !body.trim()} className="self-start">
            {submitting ? 'Submitting…' : 'Submit for Review'}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Your Mails</h2>
        </div>
        {loadingNewsletters ? (
          <p className="text-sm p-4" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : newsletters.length === 0 ? (
          <p className="text-sm p-4" style={{ color: 'var(--color-text-muted)' }}>Nothing submitted yet.</p>
        ) : (
          <div className="flex flex-col">
            {newsletters.map(n => (
              <div key={n.id} className="p-4 border-b last:border-0 flex flex-col gap-1.5" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{n.subject}</p>
                  {statusBadge(n.status)}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                  Submitted {formatShortDate(n.submitted_at.split('T')[0])}
                  {n.status === 'approved' && n.recipient_count != null && ` · delivered to ${n.recipient_count} recipient${n.recipient_count !== 1 ? 's' : ''}`}
                </p>
                {n.status === 'rejected' && n.rejection_reason && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-red)' }}>Reason: {n.rejection_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
