'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Upload, Eye, Save, CloudOff, Check, Loader2 } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ACCENT_COLOR_PRESETS } from '@/lib/accentColors';
import { BannerCropInput } from '@/components/organizer/BannerCropInput';
import { FlyersField } from '@/components/organizer/FlyersField';
import { FeeSplitField } from '@/components/organizer/FeeSplitField';
import { DEFAULT_FEE_SPLIT, feeRatesFor, isFeeSplit, type FeeSplit } from '@/lib/feeSplit';
import { compressImageFile } from '@/lib/compressImage';
import { RefundPolicyFields, type RefundPolicyDraft } from '@/components/organizer/RefundPolicyFields';
import { parseRefundPolicy } from '@/lib/refundPolicy';
import { EventPreview } from '@/components/events/EventPreview';
import { GoLiveField } from '@/components/organizer/GoLiveField';
import { fromLagosInput, INACTIVE_GO_LIVE } from '@/lib/goLive';
import { VENUE_DEADLINE_DAYS, VENUE_TBA_LABEL, fmtVenueDeadline, venueTbaProblem } from '@/lib/venueTba';
import { TierGateFields, EMPTY_GATES, gatesPayload, gatesDraftProblem, type TierGateDraft } from '@/components/organizer/TierGateFields';
import type { DetailEvent } from '@/components/events/EventDetailContent';
import type { EventCategory } from '@/types';
import {
  newDraftId, saveLocalDraft, loadLocalDraft, listLocalDrafts, removeLocalDraft,
  putDraftFile, getDraftFiles, type LocalDraft,
} from '@/lib/eventDrafts';

interface Tier { id: string; name: string; price: string; quantity: string; description?: string; gates: TierGateDraft; }
type LineupLiability = 'headliner' | 'guest' | 'surprise';
interface LineupAct { id: string; name: string; role: string; liability: LineupLiability; photoFile?: File | null; photoPreview?: string; }

const LIABILITY_OPTIONS = [
  { value: 'guest', label: 'Guest Artist / Special Guest / Speaker' },
  { value: 'headliner', label: 'Headliner' },
  { value: 'surprise', label: 'Surprise Guest' },
];

const LIABILITY_HINT: Record<LineupLiability, string> = {
  headliner: "This is the single billed act the ticket is sold on — it carries refund liability if they don't perform. Only one allowed per event.",
  guest: 'Listed and promoted alongside the headliner — no refund exposure if they drop out.',
  surprise: "Listed on the page, but their name is never shown to buyers — you can still enter it here for your own record.",
};

/** Everything in the form except images and the two confirmations, which the
 *  organiser re-ticks before submitting. Saved as a draft (059). */
interface DraftData {
  v: 1;
  name: string; category: string; description: string; date: string; time: string;
  eventMode: 'physical' | 'online'; venue: string; address: string; city: string; landmark: string;
  locationHidden: boolean; venueTba?: boolean; lga: string; revealAt: string; goLiveScheduled: boolean; goLiveAt: string; goLiveInactive?: boolean;
  meetingLink: string; meetingPasscode: string; venueContactName: string; venueContactPhone: string;
  tiers: Tier[]; accentColor: string | null; accentAutoDetected: boolean; colorManuallySet: boolean;
  lineup: { id: string; name: string; role: string; liability: LineupLiability }[];
  restrictedDomainsInput: string; refundPolicy: RefundPolicyDraft;
  feeSplit?: FeeSplit;
  /** Names of the images picked, so another device can say what to re-add. */
  files: { banner?: string; flyer2?: string; flyer3?: string; headerBanner?: string; venueProof?: string; lineup?: Record<string, string> };
}

/** The device copy remembers whether its latest edit reached the server. */
interface DeviceDraft extends DraftData { syncedAt?: string | null; dirty?: boolean }

type SaveStatus = 'idle' | 'saving' | 'saved' | 'local' | 'signed_out';

const AUTOSAVE_MS = 1500;

const eventTypes = [
  { value: 'Concert', label: 'Concert' },
  { value: 'Party', label: 'Party' },
  { value: 'Festival', label: 'Festival' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Theater', label: 'Theater' },
  { value: 'Conference', label: 'Conference' },
  { value: 'Other', label: 'Other' },
];

export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Concert');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [eventMode, setEventMode] = useState<'physical' | 'online'>('physical');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationHidden, setLocationHidden] = useState(false);
  // Venue to be announced (061): city + LGA now, venue at least 7 days before.
  const [venueTba, setVenueTba] = useState(false);
  const [lga, setLga] = useState('');
  const [revealAt, setRevealAt] = useState('');
  const [goLiveScheduled, setGoLiveScheduled] = useState(false);
  const [goLiveInactive, setGoLiveInactive] = useState(false);
  const [goLiveAt, setGoLiveAt] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingPasscode, setMeetingPasscode] = useState('');
  const [banner, setBanner] = useState<File | null>(null);
  // Flyers 2 and 3 (061); `banner` stays the main flyer.
  const [moreFlyers, setMoreFlyers] = useState<File[]>([]);
  const [headerBanner, setHeaderBanner] = useState<File | null>(null);
  const [venueProof, setVenueProof] = useState<File | null>(null);
  const [venueContactName, setVenueContactName] = useState('');
  const [venueContactPhone, setVenueContactPhone] = useState('');
  const [tiers, setTiers] = useState<Tier[]>([{ id: '1', name: 'Regular', price: '', quantity: '', description: '', gates: EMPTY_GATES }]);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [accentAutoDetected, setAccentAutoDetected] = useState(false);
  const [colorManuallySet, setColorManuallySet] = useState(false);

  const handleColorExtracted = (hex: string | null) => {
    if (colorManuallySet || !hex) return;
    setAccentColor(hex);
    setAccentAutoDetected(true);
  };
  const pickAccent = (hex: string | null) => {
    setColorManuallySet(true);
    setAccentAutoDetected(false);
    setAccentColor(hex);
  };
  const [lineup, setLineup] = useState<LineupAct[]>([]);
  const [restrictedDomainsInput, setRestrictedDomainsInput] = useState('');
  const [refundPolicy, setRefundPolicy] = useState<RefundPolicyDraft>({});
  const [policyConfirmed, setPolicyConfirmed] = useState(false);
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [me, setMe] = useState<{ id?: string; name?: string; verified?: boolean; handle?: string | null; avatar_url?: string | null; member_since?: string; socials?: Record<string, string>; platform_fee_rate?: number | null } | null>(null);
  // Who pays Ventry's 5% (062).
  const [feeSplit, setFeeSplit] = useState<FeeSplit>(DEFAULT_FEE_SPLIT);
  const [previewing, setPreviewing] = useState(false);

  // ── Drafts ──────────────────────────────────────────────────
  const [draftId, setDraftId] = useState<string | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [otherDrafts, setOtherDrafts] = useState<{ id: string; name: string }[]>([]);
  const submittedRef = useRef(false);

  // The organiser's display name, for the refund-policy preview; their
  // account email pre-fills the refund contact (they can change it).
  useEffect(() => {
    fetch('/api/organizer/me')
      .then(r => r.json())
      .then(d => {
        if (!d?.data) return;
        setDisplayName(d.data.name ?? '');
        setMe(d.data);
        setRefundPolicy(p => (p.contactEmail ? p : { ...p, contactEmail: d.data.email ?? '' }));
      })
      .catch(() => {});
  }, []);
  const policyCheck = parseRefundPolicy(refundPolicy);

  const draftData: DraftData = useMemo(() => ({
    v: 1, name, category, description, date, time, eventMode, venue, address, city, landmark,
    locationHidden, venueTba, lga, revealAt, goLiveScheduled, goLiveAt, goLiveInactive, meetingLink, meetingPasscode,
    venueContactName, venueContactPhone, tiers, accentColor, accentAutoDetected, colorManuallySet,
    lineup: lineup.map(a => ({ id: a.id, name: a.name, role: a.role, liability: a.liability })),
    restrictedDomainsInput, refundPolicy, feeSplit,
    files: {
      banner: banner?.name, flyer2: moreFlyers[0]?.name, flyer3: moreFlyers[1]?.name, headerBanner: headerBanner?.name, venueProof: venueProof?.name,
      lineup: Object.fromEntries(lineup.filter(a => a.photoFile).map(a => [a.id, a.photoFile!.name])),
    },
  }), [name, category, description, date, time, eventMode, venue, address, city, landmark, locationHidden, venueTba, lga, revealAt,
    goLiveScheduled, goLiveAt, goLiveInactive, meetingLink, meetingPasscode, venueContactName, venueContactPhone, tiers, accentColor,
    accentAutoDetected, colorManuallySet, lineup, restrictedDomainsInput, refundPolicy, feeSplit, banner, moreFlyers, headerBanner, venueProof]);

  // Only start a draft once the organiser has actually entered something; the
  // refund-contact email pre-fill alone shouldn't create one.
  const hasContent = !!(
    name.trim() || description.trim() || date || time || venue.trim() || address.trim() || city.trim() || lga.trim() ||
    landmark.trim() || meetingLink.trim() || restrictedDomainsInput.trim() || lineup.length || banner || headerBanner || venueProof ||
    tiers.length > 1 || tiers.some(t => t.price || t.quantity || t.description || t.name !== 'Regular')
  );

  const latestRef = useRef(draftData);
  useEffect(() => { latestRef.current = draftData; }, [draftData]);

  /** The draft id, creating one (and putting it in the URL so a refresh comes back to it). */
  const ensureDraftId = useCallback(() => {
    if (draftIdRef.current) return draftIdRef.current;
    const id = newDraftId();
    draftIdRef.current = id;
    setDraftId(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('draft', id);
      window.history.replaceState(window.history.state, '', url.toString());
    } catch { /* ignore */ }
    return id;
  }, []);

  const writeDevice = useCallback((id: string, data: DraftData, patch: Partial<DeviceDraft>) => {
    const prev = loadLocalDraft<DeviceDraft>(id)?.data;
    const draft: LocalDraft<DeviceDraft> = {
      id, name: data.name.trim(), updatedAt: new Date().toISOString(),
      data: { ...data, syncedAt: prev?.syncedAt ?? null, dirty: prev?.dirty ?? true, ...patch },
    };
    return saveLocalDraft(draft);
  }, []);

  // Server saves run one at a time; a change during a save queues one more.
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const saveToServer = useCallback(async (): Promise<boolean> => {
    const id = draftIdRef.current;
    if (!id || submittedRef.current) return false;
    if (savingRef.current) { queuedRef.current = true; return false; }
    savingRef.current = true;
    setSaveStatus('saving');
    let ok = false;
    do {
      queuedRef.current = false;
      const data = latestRef.current;
      ok = false;
      try {
        const res = await fetch(`/api/organizer/event-drafts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name, data }),
          keepalive: true,
        });
        if (res.ok) {
          const d = await res.json().catch(() => ({}));
          const at: string = d?.data?.updated_at ?? new Date().toISOString();
          // Only mark the device copy clean if nothing changed mid-request.
          if (latestRef.current === data) writeDevice(id, data, { syncedAt: at, dirty: false });
          setSavedAt(at);
          setSaveStatus('saved');
          ok = true;
        } else {
          setSaveStatus(res.status === 401 ? 'signed_out' : 'local');
        }
      } catch {
        setSaveStatus('local');
      }
    } while (queuedRef.current && !submittedRef.current);
    savingRef.current = false;
    return ok;
  }, [writeDevice]);

  function applyDraft(d: DraftData, files: Record<string, File>) {
    setName(d.name ?? ''); setCategory(d.category ?? 'Concert'); setDescription(d.description ?? '');
    setDate(d.date ?? ''); setTime(d.time ?? ''); setEventMode(d.eventMode === 'online' ? 'online' : 'physical');
    setVenue(d.venue ?? ''); setAddress(d.address ?? ''); setCity(d.city ?? ''); setLandmark(d.landmark ?? '');
    setLocationHidden(!!d.locationHidden); setVenueTba(!!d.venueTba); setLga(d.lga ?? ''); setRevealAt(d.revealAt ?? '');
    setGoLiveScheduled(!!d.goLiveScheduled); setGoLiveAt(d.goLiveAt ?? ''); setGoLiveInactive(!!d.goLiveInactive);
    setMeetingLink(d.meetingLink ?? ''); setMeetingPasscode(d.meetingPasscode ?? '');
    setVenueContactName(d.venueContactName ?? ''); setVenueContactPhone(d.venueContactPhone ?? '');
    if (Array.isArray(d.tiers) && d.tiers.length) setTiers(d.tiers.map(t => ({ ...t, gates: t.gates ?? EMPTY_GATES })));
    setAccentColor(d.accentColor ?? null); setAccentAutoDetected(!!d.accentAutoDetected); setColorManuallySet(!!d.colorManuallySet);
    setRestrictedDomainsInput(d.restrictedDomainsInput ?? '');
    if (isFeeSplit(d.feeSplit)) setFeeSplit(d.feeSplit);
    if (d.refundPolicy) setRefundPolicy(d.refundPolicy);
    setBanner(files.banner ?? null);
    setMoreFlyers([files.flyer2, files.flyer3].filter((f): f is File => !!f));
    setHeaderBanner(files.headerBanner ?? null);
    setVenueProof(files.venueProof ?? null);
    setLineup((d.lineup ?? []).map(a => {
      const f = files[`lineup:${a.id}`];
      return { ...a, photoFile: f ?? null, photoPreview: f ? URL.createObjectURL(f) : undefined };
    }));
    // Images picked on another device (or cleared from this browser) need re-adding.
    const missing: string[] = [];
    if (d.files?.banner && !files.banner) missing.push('event flyer');
    const lostFlyers = [d.files?.flyer2 && !files.flyer2, d.files?.flyer3 && !files.flyer3].filter(Boolean).length;
    if (lostFlyers) missing.push(`${lostFlyers} more flyer${lostFlyers > 1 ? 's' : ''}`);
    if (d.files?.headerBanner && !files.headerBanner) missing.push('header banner');
    if (d.files?.venueProof && !files.venueProof) missing.push('venue proof');
    const lostPhotos = Object.keys(d.files?.lineup ?? {}).filter(k => !files[`lineup:${k}`]).length;
    if (lostPhotos) missing.push(`${lostPhotos} lineup photo${lostPhotos > 1 ? 's' : ''}`);
    setMissingFiles(missing);
  }

  // Restore a draft named in the URL (?draft=…); otherwise offer existing ones.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = new URLSearchParams(window.location.search).get('draft');
      if (!id) {
        const local = listLocalDrafts();
        let server: { id: string; name: string }[] = [];
        try {
          const r = await fetch('/api/organizer/event-drafts', { cache: 'no-store' });
          const d = await r.json();
          if (d?.success) server = d.data;
        } catch { /* offline */ }
        const seen = new Set<string>();
        const all = [...server, ...local].filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
        if (!cancelled) { setOtherDrafts(all.map(x => ({ id: x.id, name: x.name }))); setHydrated(true); }
        return;
      }

      draftIdRef.current = id;
      setDraftId(id);
      const device = loadLocalDraft<DeviceDraft>(id);
      let server: { data: DraftData; updated_at: string } | null = null;
      try {
        const r = await fetch(`/api/organizer/event-drafts/${id}`, { cache: 'no-store' });
        if (r.ok) server = (await r.json())?.data ?? null;
      } catch { /* offline: use the device copy */ }

      // Unsynced edits on this device win; otherwise take the server copy if
      // it was saved after this device last synced (e.g. edited elsewhere).
      let pick: DraftData | null = device?.data ?? null;
      if (server && (!device || (!device.data.dirty && (!device.data.syncedAt || server.updated_at > device.data.syncedAt)))) {
        pick = server.data;
      }
      const files = await getDraftFiles(id);
      if (cancelled) return;
      if (pick) {
        applyDraft(pick, files);
        if (server) setSavedAt(server.updated_at);
        setSaveStatus(server ? 'saved' : 'local');
      } else {
        toast('That draft could not be found. You can start a new event here.', 'error');
      }
      setHydrated(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave: the device copy straight away, the server once typing pauses.
  useEffect(() => {
    if (!hydrated || submittedRef.current) return;
    if (!draftIdRef.current && !hasContent) return;
    const id = ensureDraftId();
    writeDevice(id, draftData, { dirty: true });
    const t = setTimeout(() => { void saveToServer(); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftData, hydrated]);

  // Phones often discard the tab while the gallery/camera is open, so push
  // the latest copy out the moment the page is hidden.
  useEffect(() => {
    const flush = () => {
      const id = draftIdRef.current;
      if (!id || submittedRef.current) return;
      writeDevice(id, latestRef.current, {});
      void saveToServer();
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [writeDevice, saveToServer]);

  /** Keep a picked image with the draft on this device. */
  const persistFile = (slot: string, file: File | null) => {
    if (!file && !draftIdRef.current) return;
    void putDraftFile(ensureDraftId(), slot, file);
  };
  /** Replace the whole flyer list (main first) and keep the draft's copies in step. */
  const setFlyers = (list: File[]) => {
    const [main, ...rest] = list.slice(0, 3);
    setBanner(main ?? null);
    setMoreFlyers(rest);
    persistFile('banner', main ?? null);
    persistFile('flyer2', rest[0] ?? null);
    persistFile('flyer3', rest[1] ?? null);
  };
  const allFlyers = [banner, ...moreFlyers].filter((f): f is File => !!f);
  const pickHeaderBanner = (f: File | null) => { setHeaderBanner(f); persistFile('headerBanner', f); };
  const pickVenueProof = (f: File | null) => { setVenueProof(f); persistFile('venueProof', f); };

  const saveDraftNow = async () => {
    const id = ensureDraftId();
    writeDevice(id, latestRef.current, { dirty: true });
    const ok = await saveToServer();
    if (ok) toast('Draft saved. Continue any time from My Events.', 'success');
    else if (savingRef.current || queuedRef.current) toast('Saving your draft…', 'success');
    else toast('Saved on this device. It will sync to your account once you’re online and signed in.', 'error');
  };

  const flyerUrl = useMemo(() => (banner ? URL.createObjectURL(banner) : null), [banner]);
  const moreFlyerUrls = useMemo(() => moreFlyers.map(f => URL.createObjectURL(f)), [moreFlyers]);
  useEffect(() => () => { moreFlyerUrls.forEach(u => URL.revokeObjectURL(u)); }, [moreFlyerUrls]);
  const headerUrl = useMemo(() => (headerBanner ? URL.createObjectURL(headerBanner) : null), [headerBanner]);
  useEffect(() => () => { if (flyerUrl) URL.revokeObjectURL(flyerUrl); }, [flyerUrl]);
  useEffect(() => () => { if (headerUrl) URL.revokeObjectURL(headerUrl); }, [headerUrl]);

  // The event exactly as the page will render it once live, built from the
  // unsaved form. Nothing is uploaded or saved to preview it.
  const previewEvent: DetailEvent = {
    id: 'preview',
    slug: 'preview',
    name: name.trim() || 'Your event name',
    category: category as EventCategory,
    description,
    date: date || new Date().toISOString().slice(0, 10),
    time,
    event_mode: eventMode,
    venue: venueTba ? VENUE_TBA_LABEL : locationHidden ? 'Exact location undisclosed' : venue,
    address: venueTba || locationHidden ? '' : address,
    venueTba,
    city,
    lga: lga || null,
    addressRevealAt: locationHidden && revealAt ? ((v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : ''))(revealAt) : null,
    landmark: landmark || null,
    location_hidden: locationHidden,
    locationHidden,
    status: 'approved',
    totalSold: 0,
    bannerColor: 'from-purple-900 to-indigo-900',
    banner_url: flyerUrl,
    flyerUrls: [flyerUrl, ...moreFlyerUrls].filter((u): u is string => !!u),
    headerBannerUrl: headerUrl,
    accentColor,
    buyerFeeRate: feeRatesFor(feeSplit, me?.platform_fee_rate ?? null).buyer,
    verified: false,
    refundPolicy: policyCheck.ok ? policyCheck.value : null,
    allowedEmailDomains: restrictedDomainsInput.split(',').map(d => d.trim()).filter(Boolean),
    lineup: lineup
      .filter(a => a.name.trim() || a.liability === 'surprise')
      .map(a => ({ name: a.liability === 'surprise' ? '' : a.name, role: a.role, liability: a.liability, photoUrl: a.photoPreview ?? null })),
    tiers: tiers.map((t, i) => { const g = gatesPayload(t.gates); return { id: `preview-${i}`, name: t.name.trim() || `Tier ${i + 1}`, price: Number(t.price) || 0, description: t.description ?? null, available: Number(t.quantity) || 0, sold: 0, requiresCode: g.requiresCode, allowedEmailDomains: g.allowedEmailDomains.length ? g.allowedEmailDomains : null }; }),
    organizer: {
      id: me?.id ?? 'preview',
      name: me?.name ?? displayName,
      email: '',
      phone: '',
      tier: 'Standard',
      verified: !!me?.verified,
      memberSince: me?.member_since ?? '',
      eventsHosted: 0,
      handle: me?.handle ?? null,
      avatar_url: me?.avatar_url ?? null,
      kycStatus: 'approved',
      socials: me?.socials,
    },
  };

  const addTier = () => setTiers(p => [...p, { id: Date.now().toString(), name: '', price: '', quantity: '', gates: EMPTY_GATES }]);
  const updateTierGates = (id: string, gates: TierGateDraft) =>
    setTiers(p => p.map(t => (t.id === id ? { ...t, gates } : t)));
  const removeTier = (id: string) => { if (tiers.length > 1) setTiers(p => p.filter(t => t.id !== id)); };
  const updateTier = (id: string, field: Exclude<keyof Tier, 'gates'>, value: string) =>
    setTiers(p => p.map(t => (t.id === id ? { ...t, [field]: value } : t)));

  const addAct = () => setLineup(p => [...p, { id: Date.now().toString(), name: '', role: '', liability: 'guest' }]);
  const removeAct = (id: string) => { setLineup(p => p.filter(a => a.id !== id)); persistFile(`lineup:${id}`, null); };
  const updateAct = (id: string, field: 'name' | 'role', value: string) =>
    setLineup(p => p.map(a => (a.id === id ? { ...a, [field]: value } : a)));
  const updateLiability = (id: string, liability: LineupLiability) =>
    setLineup(p => p.map(a => {
      if (a.id === id) return { ...a, liability };
      // Only one Headliner allowed — picking a new one demotes the old one.
      if (liability === 'headliner' && a.liability === 'headliner') return { ...a, liability: 'guest' };
      return a;
    }));
  const updatePhoto = (id: string, file: File | null) => {
    setLineup(p => p.map(a => (a.id === id ? { ...a, photoFile: file, photoPreview: file ? URL.createObjectURL(file) : undefined } : a)));
    persistFile(`lineup:${id}`, file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyCheck.ok) { toast(policyCheck.error, 'error'); return; }
    if (!policyConfirmed) { toast('Confirm your refund policy before submitting', 'error'); return; }
    if (!accuracyConfirmed) { toast('Confirm your event information is accurate before submitting', 'error'); return; }
    if (!goLiveInactive && goLiveScheduled && !goLiveAt) { toast('Choose when your tickets go on sale', 'error'); return; }
    for (const t of tiers) {
      const gateProblem = gatesDraftProblem(t.gates, t.name.trim());
      if (gateProblem) { toast(gateProblem, 'error'); return; }
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('category', category);
      fd.append('description', description);
      fd.append('date', date);
      fd.append('time', time);
      fd.append('eventMode', eventMode);
      if (eventMode === 'physical' && venueTba) {
        fd.append('venueTba', 'true');
        fd.append('city', city);
        fd.append('lga', lga);
        fd.append('venueContactName', venueContactName);
        fd.append('venueContactPhone', venueContactPhone);
      } else if (eventMode === 'physical') {
        fd.append('venue', venue);
        fd.append('address', address);
        fd.append('city', city);
        fd.append('landmark', landmark);
        fd.append('locationHidden', String(locationHidden));
        fd.append('lga', lga);
        if (locationHidden) fd.append('addressRevealAt', ((v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : ''))(revealAt));
        if (venueProof) fd.append('venueProof', await compressImageFile(venueProof));
        fd.append('venueContactName', venueContactName);
        fd.append('venueContactPhone', venueContactPhone);
      } else {
        fd.append('meetingLink', meetingLink);
        fd.append('meetingPasscode', meetingPasscode);
      }
      fd.append('tiers', JSON.stringify(tiers.map(t => ({ name: t.name, price: t.price, quantity: t.quantity, description: t.description ?? null, ...gatesPayload(t.gates) }))));
      if (accentColor) fd.append('accentColor', accentColor);
      fd.append('refundPolicy', JSON.stringify(policyCheck.value));
      fd.append('feeSplit', feeSplit);
      fd.append('confirmAccurate', 'true');
      if (goLiveInactive) fd.append('goesLiveAt', INACTIVE_GO_LIVE);
      else if (goLiveScheduled && goLiveAt) fd.append('goesLiveAt', fromLagosInput(goLiveAt) ?? '');
      const domains = restrictedDomainsInput.split(',').map(d => d.trim()).filter(Boolean);
      if (domains.length) fd.append('allowedEmailDomains', JSON.stringify(domains));
      const validLineup = lineup.filter(a => a.name.trim() || a.liability === 'surprise');
      if (validLineup.length) {
        fd.append('lineup', JSON.stringify(validLineup.map(a => ({ name: a.name, role: a.role, liability: a.liability }))));
        for (let i = 0; i < validLineup.length; i++) {
          const a = validLineup[i];
          if (a.photoFile) fd.append(`lineupPhoto${i}`, await compressImageFile(a.photoFile));
        }
      }
      if (banner) fd.append('banner', banner);
      if (moreFlyers[0]) fd.append('flyer2', moreFlyers[0]);
      if (moreFlyers[1]) fd.append('flyer3', moreFlyers[1]);
      if (headerBanner) fd.append('headerBanner', headerBanner);

      // Vercel hard-caps the function request body at 4.5MB regardless of the
      // app's own per-file limits — this request can carry a flyer, header
      // banner, venue proof, and several lineup photos at once, so warn
      // before a doomed round trip instead of surfacing a bare network error.
      let totalBytes = 0;
      fd.forEach(v => { if (v instanceof File) totalBytes += v.size; });
      if (totalBytes > 4 * 1024 * 1024) {
        toast('Your images are too large to upload together — try smaller files for the venue proof or lineup photos.', 'error');
        return;
      }

      const res = await fetch('/api/organizer/events', { method: 'POST', body: fd });
      let data: { error?: string; data?: { eventId: string; goesLiveAt?: string | null } };
      try {
        data = await res.json();
      } catch {
        toast(
          res.status === 413
            ? 'Your images are too large to upload together — try smaller files and try again.'
            : 'Something went wrong on our end. Please try again.',
          'error',
        );
        return;
      }
      if (!res.ok) {
        toast(
          res.status === 401
            ? 'You were signed out. Your draft is saved: sign in again and continue it from My Events.'
            : (data.error || 'Failed to create event'),
          'error',
        );
        return;
      }
      // The event exists now, so drop the draft everywhere.
      submittedRef.current = true;
      const doneId = draftIdRef.current;
      if (doneId) {
        removeLocalDraft(doneId);
        fetch(`/api/organizer/event-drafts/${doneId}`, { method: 'DELETE' }).catch(() => {});
      }
      toast('Submitted for review! We’ll email you as soon as your event is approved, usually within 24 hours.', 'success');
      const newId = data.data?.eventId;
      router.push(newId ? `/organizer/events/${newId}` : '/organizer/events');
    } catch {
      toast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>Create Event</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Fill in all sections and submit for review. Your progress saves automatically.</p>
      </div>

      <div className="sticky top-0 z-20 -mt-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <span className="text-xs flex items-center gap-1.5 min-w-0"
          style={{ color: saveStatus === 'signed_out' || saveStatus === 'local' ? 'var(--color-amber)' : 'var(--color-text-muted)' }}>
          {saveStatus === 'saving' && <><Loader2 size={13} className="animate-spin flex-shrink-0" />Saving draft…</>}
          {saveStatus === 'saved' && <><Check size={13} className="flex-shrink-0" style={{ color: 'var(--color-green)' }} />Draft saved{savedAt ? ` · ${new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</>}
          {saveStatus === 'local' && <><CloudOff size={13} className="flex-shrink-0" />Saved on this device. Will sync when you&apos;re back online.</>}
          {saveStatus === 'signed_out' && <><CloudOff size={13} className="flex-shrink-0" />Signed out. Saved on this device; sign in again to sync.</>}
          {saveStatus === 'idle' && <>{draftId ? 'Draft' : 'Saves automatically as you fill it in.'}</>}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={saveDraftNow} disabled={!hydrated || (!hasContent && !draftId)}>
          <Save size={13} />Save draft
        </Button>
      </div>

      {!draftId && otherDrafts.length > 0 && (
        <div className="rounded-xl border px-4 py-3 text-sm flex flex-col gap-2"
          style={{ backgroundColor: 'var(--color-purple-dim)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          <p>You have {otherDrafts.length === 1 ? 'an unfinished draft' : `${otherDrafts.length} unfinished drafts`}. Pick up where you stopped:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {otherDrafts.slice(0, 3).map(d => (
              <a key={d.id} href={`/organizer/events/create?draft=${d.id}`} className="font-medium underline" style={{ color: 'var(--color-purple-light)' }}>
                {d.name || 'Untitled draft'}
              </a>
            ))}
            {otherDrafts.length > 3 && <Link href="/organizer/events" className="underline">See all in My Events</Link>}
          </div>
        </div>
      )}

      {missingFiles.length > 0 && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ backgroundColor: '#f59e0b10', borderColor: '#f59e0b30', color: 'var(--color-text-muted)' }}>
          Draft restored. Images stay on the device that picked them, so please re-add: <strong style={{ color: 'var(--color-text)' }}>{missingFiles.join(', ')}</strong>.
        </div>
      )}

      <section className="rounded-xl border p-6 flex flex-col gap-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>1. Event Details</h2>
        <Input label="Event Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Afrobeat Vibes Festival 2026" required />
        <Select label="Event Type" options={eventTypes} value={category} onChange={e => setCategory(e.target.value)} />
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell attendees what to expect..." rows={4} />
        <FlyersField
          items={[flyerUrl, ...moreFlyerUrls].filter((u): u is string => !!u).map((u, i) => ({ key: `${i}-${u}`, src: u }))}
          onAdd={f => setFlyers([...allFlyers, f])}
          onReplace={(i, f) => setFlyers(allFlyers.map((x, j) => (j === i ? f : x)))}
          onRemove={i => setFlyers(allFlyers.filter((_, j) => j !== i))}
          onMove={(from, to) => { const next = [...allFlyers]; [next[from], next[to]] = [next[to], next[from]]; setFlyers(next); }}
          onColorExtracted={handleColorExtracted}
        />
        <div>
          <BannerCropInput
            label="Event Page Header Banner (optional)"
            ratio={2}
            minWidth={1200}
            minHeight={600}
            safeZoneHint
            onCropped={pickHeaderBanner}
            onColorExtracted={handleColorExtracted}
            buttonText={headerBanner ? `${headerBanner.name} — click to replace` : 'Click or drag to upload a wide header banner'}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-dim)' }}>
            A wide banner (2160×1080 recommended) shown as the fixed header on your event page — separate from the flyer above, which keeps doing its job on cards, previews, and ticket emails. Skip this and the page falls back to the flyer.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Accent Colour</label>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-dim)' }}>Tints your whole event page: the background, cards, ticket panel and buy button. In light mode it sits on white, in dark mode on Ventry&apos;s purple-black. Auto-adjusted for readability in both themes. Checkout always stays Ventry purple.</p>
          {accentAutoDetected && accentColor && (
            <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-purple-light)' }}>
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: accentColor }} />
              Detected from your image — pick a swatch below to override.
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => pickAccent(null)}
              className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold"
              style={{
                borderColor: accentColor === null ? 'var(--color-text)' : 'var(--color-border)',
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
              }}
              title="Default (Ventry Purple)"
            >
              Default
            </button>
            {ACCENT_COLOR_PRESETS.map(preset => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => pickAccent(preset.hex)}
                className="w-9 h-9 rounded-full border-2"
                style={{
                  backgroundColor: preset.hex,
                  borderColor: accentColor === preset.hex ? 'var(--color-text)' : 'transparent',
                }}
                title={preset.name}
                aria-label={preset.name}
              />
            ))}
            {accentColor && !ACCENT_COLOR_PRESETS.some(p => p.hex === accentColor) && (
              <button
                type="button"
                className="w-9 h-9 rounded-full border-2"
                style={{ backgroundColor: accentColor, borderColor: 'var(--color-text)' }}
                title="Detected from your image"
                aria-label="Detected colour"
                disabled
              />
            )}
          </div>
          <button type="button" onClick={() => setPreviewing(true)} className="mt-3 inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
            <Eye size={15} />See it on your event page (light and dark)
          </button>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Restrict to Email Domains (optional)</label>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-dim)' }}>
            For closed events (e.g. a university-only event) — only buyers with an email at one of these domains can check out. Leave blank for a normal, open event.
          </p>
          <Input
            value={restrictedDomainsInput}
            onChange={e => setRestrictedDomainsInput(e.target.value)}
            placeholder="e.g. nileuniversity.edu.ng, unilag.edu.ng"
            helper="Comma-separated. No @ needed."
          />
        </div>
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>2. Date & Location</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Event Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Input label="Start Time" type="time" value={time} onChange={e => setTime(e.target.value)} required />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Event Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEventMode('physical')}
              className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors"
              style={{
                borderColor: eventMode === 'physical' ? 'var(--color-purple)' : 'var(--color-border)',
                backgroundColor: eventMode === 'physical' ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
                color: eventMode === 'physical' ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
              }}
            >
              Physical
              <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Happens at a venue</span>
            </button>
            <button
              type="button"
              onClick={() => setEventMode('online')}
              className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors"
              style={{
                borderColor: eventMode === 'online' ? 'var(--color-purple)' : 'var(--color-border)',
                backgroundColor: eventMode === 'online' ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
                color: eventMode === 'online' ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
              }}
            >
              Online
              <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Hosted via a meeting link (e.g. Zoom)</span>
            </button>
          </div>
        </div>

        {eventMode === 'physical' ? (
          <>
          <div>
            <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Venue</label>
            <div className="grid grid-cols-2 gap-3">
              {([[false, 'Venue confirmed', 'I know where it is'], [true, 'Venue to be announced', 'City now, venue later']] as const).map(([v, title, sub]) => (
                <button key={title} type="button" onClick={() => setVenueTba(v)}
                  className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors"
                  style={{
                    borderColor: venueTba === v ? 'var(--color-purple)' : 'var(--color-border)',
                    backgroundColor: venueTba === v ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
                    color: venueTba === v ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
                  }}>
                  {title}
                  <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>
          {venueTba ? (
            <>
              <Input label="City" value={city} onChange={e => setCity(e.target.value)} placeholder="Lagos" helper="Always shown to buyers." required />
              <Input label="Local Government Area (LGA)" value={lga} onChange={e => setLga(e.target.value)} placeholder="e.g. Eti-Osa" helper="Always shown to buyers." required />
              <div className="rounded-lg px-4 py-3 text-sm flex flex-col gap-1.5" style={{ backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30', color: 'var(--color-text-muted)' }}>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>How “venue to be announced” works</p>
                <p>• Buyers see the city and LGA, with “Venue to be announced”.</p>
                <p>• Add the venue no later than <strong style={{ color: 'var(--color-text)' }}>{VENUE_DEADLINE_DAYS} days before the event</strong>{date && time ? <> (by <strong style={{ color: 'var(--color-text)' }}>{fmtVenueDeadline(date, time)}</strong>)</> : null}. We&apos;ll remind you 10 and 8 days before.</p>
                <p>• If it&apos;s not added by then, ticket sales pause and the event may be cancelled, with buyers refunded through the normal process.</p>
                <p>• As soon as you add it, everyone with a ticket is emailed the venue.</p>
                {date && time && venueTbaProblem(date, time) && (
                  <p style={{ color: 'var(--color-red)' }}>{venueTbaProblem(date, time)}</p>
                )}
              </div>
            </>
          ) : (
          <>
            <Input label="Venue Name" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Eko Atlantic City Arena" required />
            <Input label="Venue Address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full street address" required />
            <Input label="City" value={city} onChange={e => setCity(e.target.value)} placeholder="Lagos" required />
            <Input label="Local Government Area (LGA)" value={lga} onChange={e => setLga(e.target.value)} placeholder="e.g. Enugu East" helper="Always shown to buyers, even if you hide the street address." required />
            <Input label="Nearby Landmark" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="e.g. Landmark Towers, Victoria Island" />
            <label className="flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <input
                type="checkbox"
                checked={locationHidden}
                onChange={e => setLocationHidden(e.target.checked)}
                className="mt-0.5 flex-shrink-0 w-4 h-4 rounded accent-[var(--color-purple)]"
              />
              <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Hide the street address until a time I choose. The date, city and LGA are always shown. Ventry emails the address to every ticket holder at the reveal time.
              </span>
            </label>
            {locationHidden && (
              <Input
                label="Reveal the address at"
                type="datetime-local"
                value={revealAt}
                onChange={e => setRevealAt(e.target.value)}
                helper="Nigeria time. No later than 24 hours before your event starts."
                required
              />
            )}
            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text)' }}>Venue Proof Document</label>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>
                Upload a lease agreement, booking confirmation, or receipt from the venue. Photos of the building are <strong>not</strong> accepted as proof.
              </p>
              <label className="flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3.5 cursor-pointer transition-colors hover:border-[var(--color-purple)]" style={{ borderColor: 'var(--color-border)' }}>
                <input type="file" className="sr-only" accept=".pdf,image/*" onChange={e => pickVenueProof(e.target.files?.[0] ?? null)} />
                <Upload size={16} style={{ color: 'var(--color-text-dim)' }} />
                <span className="text-sm" style={{ color: venueProof ? 'var(--color-green)' : 'var(--color-text-muted)' }}>
                  {venueProof ? venueProof.name : 'Upload lease agreement, booking confirmation, or receipt'}
                </span>
              </label>
            </div>
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Venue contact</p>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>
                Who at the venue can confirm your booking? Ventry calls them before your event gets the <strong>Verified</strong> badge.
                You can list without this; the event just won&apos;t carry the badge.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Contact name" value={venueContactName} onChange={e => setVenueContactName(e.target.value)} placeholder="e.g. Bookings manager" />
                <Input label="Contact phone" type="tel" value={venueContactPhone} onChange={e => setVenueContactPhone(e.target.value)} placeholder="+234 …" />
              </div>
            </div>
          </>
          )}
          </>
        ) : (
          <>
            <Input label="Meeting Link" value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://zoom.us/j/..." required />
            <Input label="Passcode (optional)" value={meetingPasscode} onChange={e => setMeetingPasscode(e.target.value)} placeholder="e.g. 482913" />
            <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
              Ticket buyers never see this link directly on Ventry — it&apos;s emailed to them automatically before the event starts, along with their reminders.
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>3. Lineup (optional)</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Performers, speakers, or hosts — shown on the event page above ticket selection.</p>
        </div>
        <div className="flex flex-col gap-3">
          {lineup.map(act => (
            <div key={act.id} className="rounded-lg border p-3 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <div className="flex items-start gap-3">
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <Input label="Name" value={act.name} onChange={e => updateAct(act.id, 'name', e.target.value)} placeholder="e.g. Burna Boy" />
                  <Input label="Role" value={act.role} onChange={e => updateAct(act.id, 'role', e.target.value)} placeholder="e.g. DJ, Opening Act" />
                </div>
                <button type="button" onClick={() => removeAct(act.id)} className="mt-5" style={{ color: 'var(--color-red)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
              <Select
                label="Billing"
                options={LIABILITY_OPTIONS}
                value={act.liability}
                onChange={e => updateLiability(act.id, e.target.value as LineupLiability)}
              />
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{LIABILITY_HINT[act.liability]}</p>
              <label className="flex items-center gap-3 text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                {act.photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={act.photoPreview} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)' }}><Upload size={13} /></span>
                )}
                <input type="file" className="sr-only" accept="image/*" onChange={e => updatePhoto(act.id, e.target.files?.[0] ?? null)} />
                {act.photoPreview ? 'Change photo' : 'Add photo (optional)'}
              </label>
            </div>
          ))}
        </div>
        <button type="button" onClick={addAct} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
          <Plus size={16} />Add Lineup Act
        </button>
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>4. Ticket Tiers</h2>
        <div className="flex flex-col gap-4">
          {tiers.map((tier) => (
            <div key={tier.id} className="rounded-lg border p-4 flex flex-col gap-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Tier</p>
                {tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(tier.id)} className="text-xs flex items-center gap-1" style={{ color: 'var(--color-red)' }}>
                    <Trash2 size={13} />Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Tier Name" value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} placeholder="e.g. VIP" />
                <Input label="Price (NGN)" type="number" value={tier.price} onChange={e => updateTier(tier.id, 'price', e.target.value)} placeholder="5000" />
                <Input label="Quantity" type="number" value={tier.quantity} onChange={e => updateTier(tier.id, 'quantity', e.target.value)} placeholder="500" />
              </div>
                <Textarea label="Tier Description" value={tier.description ?? ''} onChange={e => updateTier(tier.id, 'description', e.target.value)} placeholder="What does this ticket include?" rows={3} className="col-span-3" />
                <div className="col-span-3">
                  <TierGateFields value={tier.gates} onChange={g => updateTierGates(tier.id, g)}
                    eventDomains={restrictedDomainsInput.split(',').map(d => d.trim()).filter(Boolean)} />
                </div>

            </div>
          ))}
        </div>
        <button type="button" onClick={addTier} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-purple-light)' }}>
          <Plus size={16} />Add Another Tier
        </button>
        <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <FeeSplitField value={feeSplit} onChange={setFeeSplit} organizerRate={me?.platform_fee_rate ?? null}
            examplePrice={Number(tiers.find(t => Number(t.price) > 0)?.price) || undefined} />
        </div>
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>5. Refund Policy</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
            Required before your event can go live. Five questions; Ventry writes your published policy from your answers.
          </p>
        </div>
        <RefundPolicyFields
          value={refundPolicy}
          onChange={setRefundPolicy}
          organizerName={displayName}
          confirmed={policyConfirmed}
          onConfirmedChange={setPolicyConfirmed}
        />
      </section>

      <section className="rounded-xl border p-6 flex flex-col gap-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>6. Review & Publish</h2>
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
          <p className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>Summary</p>
          <p>Event: {name || '(not set)'}</p>
          <p className="mt-1">Tiers: {tiers.length} tier{tiers.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div>
          <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>When do tickets go on sale?</p>
          <GoLiveField scheduled={goLiveScheduled} onScheduledChange={setGoLiveScheduled} value={goLiveAt} onChange={setGoLiveAt}
            nowLabel="As soon as it's approved" inactive={goLiveInactive} onInactiveChange={setGoLiveInactive}
            inactiveLabel="Approved, but hidden until I turn it on" />
        </div>
        <div className="rounded-lg px-4 py-3 flex items-start gap-3 text-sm" style={{ backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30' }}>
          <span className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }}>ⓘ</span>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Every event is <strong style={{ color: 'var(--color-text)' }}>reviewed by our team</strong> before it goes public, usually within 24 hours.
            {goLiveInactive
              ? <> Once approved, it stays inactive until you make it active from the event page.</>
              : goLiveScheduled
              ? <> Once approved, tickets go on sale at the time you picked (or at approval, if that comes later).</>
              : <> Tickets go on sale the moment it&apos;s approved.</>}
            {' '}A venue proof helps us approve physical events faster.
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
          <input
            type="checkbox"
            checked={accuracyConfirmed}
            onChange={e => setAccuracyConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[var(--color-purple)]"
          />
          <span>
            I confirm that everything I&apos;ve entered about this event is accurate and complete, that I have the right to hold it as
            described, and that I have secured the venue.
          </span>
        </label>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
          By listing this event you agree to Ventry&apos;s{' '}
          <Link href="/terms/organisers" className="underline" style={{ color: 'var(--color-text-muted)' }}>Organiser Terms of Use</Link>.
        </p>
        <Button type="button" variant="outline" size="lg" fullWidth onClick={() => setPreviewing(true)}>
          <Eye size={16} />Preview event page
        </Button>
        <Button type="submit" size="lg" fullWidth disabled={loading || !policyCheck.ok || !policyConfirmed || !accuracyConfirmed}>
          {loading ? 'Submitting...' : 'Submit for Review'}
        </Button>
      </section>
      {previewing && <EventPreview event={previewEvent} onClose={() => setPreviewing(false)} />}
    </form>
  );
}
