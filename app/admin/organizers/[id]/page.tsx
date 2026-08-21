'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Mail, X, Users, CalendarDays, Ticket, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { formatNGN, formatShortDate } from '@/lib/utils';

interface Profile {
  id: string; name: string; email: string; phone: string; handle: string | null;
  tier: string; verified: boolean; member_since: string | null; kyc_status: string;
  kyc_submitted_at: string | null; kyc_gov_id_path: string | null; kyc_selfie_path: string | null;
  kyc_social_twitter: string | null; kyc_social_instagram: string | null; kyc_social_facebook: string | null;
  kyc_venue_proof_path: string | null; kyc_rejection_reason: string | null;
  bank_name: string | null; account_number: string | null; account_name: string | null;
  platform_fee_rate: number;
}
interface EventRow { id: string; event_name: string; slug: string | null; status: string; date: string; city: string; sold: number; available: number; }
interface AudienceRow { id: string; name: string | null; email: string; phone: string | null; source: string; subscribed_at: string; unsubscribed_at: string | null; }
interface NewsletterRow { id: string; subject: string; status: string; rejection_reason: string | null; recipient_count: number | null; submitted_at: string; sent_at: string | null; }
interface SendLogRow { recipient_email: string; status: string; sent_at: string; }

const eventStatusBadge = (status: string) => {
  switch (status) {
    case 'approved':     return <Badge variant="green">Approved</Badge>;
    case 'under_review': return <Badge variant="amber">Under Review</Badge>;
    case 'completed':    return <Badge variant="blue">Completed</Badge>;
    case 'cancelled':    return <Badge variant="red">Cancelled</Badge>;
    default:             return <Badge variant="gray">{status}</Badge>;
  }
};
const newsletterStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':  return <Badge variant="amber">Pending</Badge>;
    case 'approved': return <Badge variant="green">Sent</Badge>;
    case 'rejected': return <Badge variant="red">Rejected</Badge>;
    default:         return <Badge variant="gray">{status}</Badge>;
  }
};
const sourceBadge = (source: string) =>
  source === 'ticket_consent' ? <Badge variant="purple">Ticket Purchase</Badge> : <Badge variant="blue">Notify Me</Badge>;

export default function AdminOrganizerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<{ totalEvents: number; totalSold: number; totalAvailable: number; totalRevenue: number; audienceSize: number } | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [audience, setAudience] = useState<AudienceRow[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [sendLogFor, setSendLogFor] = useState<NewsletterRow | null>(null);
  const [sendLog, setSendLog] = useState<SendLogRow[] | null>(null);
  const [sendLogLoading, setSendLogLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/organizers/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProfile(d.data.profile);
          setStats(d.data.stats);
          setEvents(d.data.events);
          setAudience(d.data.audience);
          setNewsletters(d.data.newsletters);
        } else {
          toast(d.error || 'Organiser not found', 'error');
          router.push('/admin/organizers');
        }
      })
      .catch(() => toast('Failed to load organiser', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (id) load(); }, [id]);

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/admin/organizers/${id}/remove-audience-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) { toast('Failed to remove member', 'error'); return; }
      toast('Removed from audience', 'success');
      load();
    } finally {
      setRemovingId(null);
    }
  };

  const openSendLog = async (n: NewsletterRow) => {
    setSendLogFor(n);
    setSendLog(null);
    setSendLogLoading(true);
    try {
      const res = await fetch(`/api/admin/newsletters/${n.id}/sends`);
      const data = await res.json();
      if (data.success) setSendLog(data.data);
    } finally {
      setSendLogLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading organiser...</p>
      </div>
    );
  }
  if (!profile || !stats) return null;

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div>
        <Link href="/admin/organizers" className="inline-flex items-center gap-1.5 text-sm mb-4"
          style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={14} />Back to Organisers
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
              {profile.name}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {profile.email} &bull; {profile.phone}{profile.handle && <> &bull; @{profile.handle}</>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {profile.verified && <Badge variant="green">Verified</Badge>}
            <Badge variant="purple">{profile.tier}</Badge>
            {profile.handle && (
              <a href={`/${profile.handle}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--color-purple-light)' }}>
                Storefront <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Events', value: stats.totalEvents.toLocaleString(), icon: CalendarDays },
          { label: 'Tickets Sold', value: stats.totalSold.toLocaleString(), icon: Ticket },
          { label: 'Tickets Available', value: stats.totalAvailable.toLocaleString(), icon: Ticket },
          { label: 'Revenue', value: formatNGN(stats.totalRevenue), icon: Wallet },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border p-4"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--color-text-dim)' }}>
              <Icon size={12} /><p className="text-xs">{label}</p>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* KYC & bank */}
      <div className="rounded-xl border p-5 flex flex-col gap-3"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>KYC &amp; Payout Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>KYC status</span><span style={{ color: 'var(--color-text)' }}>{profile.kyc_status}</span></div>
          <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Platform fee rate</span><span style={{ color: 'var(--color-text)' }}>{(profile.platform_fee_rate * 100).toFixed(1)}%</span></div>
          <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Bank</span><span style={{ color: 'var(--color-text)' }}>{profile.bank_name || 'Not on file'}</span></div>
          <div className="flex justify-between gap-3"><span style={{ color: 'var(--color-text-muted)' }}>Account</span><span style={{ color: 'var(--color-text)' }}>{profile.account_number ? `${profile.account_name} (${profile.account_number})` : 'Not on file'}</span></div>
        </div>
        {(profile.kyc_gov_id_path || profile.kyc_selfie_path || profile.kyc_venue_proof_path) && (
          <div className="flex gap-4 flex-wrap pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            {profile.kyc_gov_id_path && <a href={profile.kyc_gov_id_path} target="_blank" rel="noopener noreferrer" className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--color-purple-light)' }}>Gov ID <ExternalLink size={11} /></a>}
            {profile.kyc_selfie_path && <a href={profile.kyc_selfie_path} target="_blank" rel="noopener noreferrer" className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--color-purple-light)' }}>Selfie <ExternalLink size={11} /></a>}
            {profile.kyc_venue_proof_path && <a href={profile.kyc_venue_proof_path} target="_blank" rel="noopener noreferrer" className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--color-purple-light)' }}>Venue Proof <ExternalLink size={11} /></a>}
          </div>
        )}
      </div>

      {/* Events */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Events ({events.length})</h2>
        </div>
        {events.length === 0 ? (
          <p className="text-sm p-4" style={{ color: 'var(--color-text-muted)' }}>No events yet.</p>
        ) : (
          <Table>
            <Thead><tr><Th>Event</Th><Th>Date</Th><Th>Sold / Available</Th><Th>Status</Th><Th>{' '}</Th></tr></Thead>
            <Tbody>
              {events.map(ev => (
                <Tr key={ev.id}>
                  <Td><p className="font-medium max-w-[180px] truncate" style={{ color: 'var(--color-text)' }}>{ev.event_name}</p></Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(ev.date)}</span></Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{ev.sold} / {ev.available}</span></Td>
                  <Td>{eventStatusBadge(ev.status)}</Td>
                  <Td>
                    <Link href={`/admin/events/${ev.id}`} className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--color-purple-light)' }}>
                      Buyers <ExternalLink size={12} />
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Audience */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
          <Users size={15} style={{ color: 'var(--color-text-muted)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Audience ({stats.audienceSize} active)</h2>
        </div>
        {audience.length === 0 ? (
          <p className="text-sm p-4" style={{ color: 'var(--color-text-muted)' }}>No one yet.</p>
        ) : (
          <Table>
            <Thead><tr><Th>Name</Th><Th>Email</Th><Th>Source</Th><Th>Joined</Th><Th>Status</Th><Th>{' '}</Th></tr></Thead>
            <Tbody>
              {audience.map(a => (
                <Tr key={a.id}>
                  <Td><span style={{ color: 'var(--color-text)' }}>{a.name || 'Anonymous'}</span></Td>
                  <Td><span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{a.email}</span></Td>
                  <Td>{sourceBadge(a.source)}</Td>
                  <Td><span style={{ color: 'var(--color-text-muted)' }}>{formatShortDate(a.subscribed_at.split('T')[0])}</span></Td>
                  <Td>{a.unsubscribed_at ? <Badge variant="gray">Unsubscribed</Badge> : <Badge variant="green">Active</Badge>}</Td>
                  <Td>
                    {!a.unsubscribed_at && (
                      <button onClick={() => handleRemoveMember(a.id)} disabled={removingId === a.id}
                        className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--color-red)' }}>
                        <X size={12} />{removingId === a.id ? 'Removing…' : 'Remove'}
                      </button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Newsletters */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
          <Mail size={15} style={{ color: 'var(--color-text-muted)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Newsletters ({newsletters.length})</h2>
        </div>
        {newsletters.length === 0 ? (
          <p className="text-sm p-4" style={{ color: 'var(--color-text-muted)' }}>Nothing submitted yet.</p>
        ) : (
          <div className="flex flex-col">
            {newsletters.map(n => (
              <div key={n.id} className="p-4 border-b last:border-0 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{n.subject}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                    Submitted {formatShortDate(n.submitted_at.split('T')[0])}
                    {n.status === 'approved' && n.recipient_count != null && ` · ${n.recipient_count} recipient${n.recipient_count !== 1 ? 's' : ''}`}
                    {n.status === 'rejected' && n.rejection_reason && ` · ${n.rejection_reason}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {newsletterStatusBadge(n.status)}
                  {n.status === 'approved' && (
                    <button onClick={() => openSendLog(n)} className="text-xs" style={{ color: 'var(--color-purple-light)' }}>
                      View Send Log
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!sendLogFor} onClose={() => setSendLogFor(null)} title={sendLogFor ? `Send Log — ${sendLogFor.subject}` : undefined}>
        {sendLogLoading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : !sendLog || sendLog.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No send records found.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto flex flex-col gap-2">
            {sendLog.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                <span className="font-mono text-xs" style={{ color: 'var(--color-text)' }}>{s.recipient_email}</span>
                <Badge variant={s.status === 'sent' ? 'green' : 'red'}>{s.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
