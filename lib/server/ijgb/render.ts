import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import QRCode from 'qrcode';

/**
 * Pure renderer for the IJGB Homecoming visa tickets (no DB access) — see
 * visaTicket.ts for how it plugs into the ticket lifecycle.
 *
 * Artwork: lib/server/ijgb/assets/<design>.jpg are the six approved reference
 * designs with only the sample per-ticket text removed
 * (scripts/ijgb/clean_templates.py). All coordinates below are in that
 * 1280x720 reference space; output is rendered at SCALE x.
 */

// ── Designs ────────────────────────────────────────────────────────────────
export type VisaDesign =
  | 'early-bird' | 'standard' | 'elite' | 'distinguished' | 'distinguished-pro' | 'grand-patron';

interface Palette { ink: string; mrz: string; serial: string }

// Ink colours sampled from the sample text of each reference design.
const PALETTES: Record<VisaDesign, Palette> = {
  'early-bird':        { ink: '#1f2310', mrz: '#262915', serial: '#3e3a24' },
  'standard':          { ink: '#0e1d08', mrz: '#13250e', serial: '#25351b' },
  'elite':             { ink: '#0a1124', mrz: '#111a2e', serial: '#22273f' },
  'distinguished':     { ink: '#240600', mrz: '#300a02', serial: '#480f09' },
  'distinguished-pro': { ink: '#e9e2ae', mrz: '#dfd9a5', serial: '#d6c78f' },
  'grand-patron':      { ink: '#f2e8b9', mrz: '#eadcab', serial: '#dcc794' },
};

/**
 * Maps a tier name to its design. Order matters ("distinguished pro" before
 * "distinguished"). Unknown tier names fall back to the Standard artwork but
 * still print their own name under Origin.
 */
export function designForTier(tierName: string): VisaDesign {
  const t = tierName.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  if (/grand\s*patron/.test(t))                 return 'grand-patron';
  if (/distinguished\s*pro/.test(t))            return 'distinguished-pro';
  if (/distinguished/.test(t))                  return 'distinguished';
  if (/elite/.test(t))                          return 'elite';
  if (/early\s*bird/.test(t))                   return 'early-bird';
  return 'standard';
}

// ── Assets ─────────────────────────────────────────────────────────────────
const ASSET_DIR = path.join(process.cwd(), 'lib', 'server', 'ijgb', 'assets');
let fonts: { serifBold: opentype.Font; mono: opentype.Font; serialMono: opentype.Font } | null = null;
const templates = new Map<VisaDesign, Buffer>();

function toArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

function loadFonts() {
  if (!fonts) {
    const f = (n: string) => opentype.parse(toArrayBuffer(fs.readFileSync(path.join(ASSET_DIR, 'fonts', n))));
    fonts = {
      serifBold:  f('NotoSerif-700.ttf'),
      mono:       f('RobotoMono-500.ttf'),
      serialMono: f('IBMPlexMono-400.ttf'),
    };
  }
  return fonts;
}

function loadTemplate(design: VisaDesign): Buffer {
  let t = templates.get(design);
  if (!t) {
    t = fs.readFileSync(path.join(ASSET_DIR, `${design}.jpg`));
    templates.set(design, t);
  }
  return t;
}

// ── Layout (reference 1280x720 space) ──────────────────────────────────────
const W = 1280;
const H = 720;
// 1920x1080 output: ~190 dpi on a full-page PDF, sharp on any phone, and
// fast to encode (mozjpeg roughly tripled render time, so it is not used).
const SCALE = 1.5;
const px = (v: number) => Math.round(v * SCALE);

/** The white square the QR sits in on every design. */
const QR_BOX = { x: 95, y: 215, size: 221 };

interface TextField { x: number; baseline: number; cap: number; maxWidth: number }

// The reference lettering is a slightly wider, heavier bold serif than Noto
// Serif Bold: matched by a small horizontal stretch, letter-spacing and a
// hairline stroke (measured against the sample text: widths within ~1%).
const VALUE_STRETCH  = 1.07;
const VALUE_TRACKING = 0.03;  // em
const VALUE_STROKE   = 0.15;  // px in 1280-space

// Positions measured from the reference glyphs (left edge, baseline, cap
// height). maxWidth stops each value short of the next column / illustration.
const FIELDS = {
  surname: { x: 372, baseline: 276.6, cap: 15,   maxWidth: 205 },
  given:   { x: 371, baseline: 346.6, cap: 15,   maxWidth: 210 },
  idno:    { x: 372, baseline: 410.6, cap: 15,   maxWidth: 212 },
  control: { x: 831, baseline: 202.6, cap: 16,   maxWidth: 265 },
  origin:  { x: 918, baseline: 410.6, cap: 15,   maxWidth: 262 },
  issue:   { x: 595, baseline: 475.6, cap: 16,   maxWidth: 290 },
} satisfies Record<string, TextField>;

/** Monospaced grids: centre of the first cell + cell pitch. */
const SERIAL = { firstCenter: 1010, pitch: 23.29, baseline: 556.6, cap: 25.5 };
const MRZ2   = { firstCenter: 92,   pitch: 1096 / 48, baseline: 671, cap: 16.6, cells: 49 };

// ── Text → SVG paths ───────────────────────────────────────────────────────
function capHeightRatio(font: opentype.Font): number {
  const os2 = (font.tables as { os2?: { sCapHeight?: number } }).os2;
  const cap = os2?.sCapHeight || font.charToGlyph('H').getBoundingBox().y2;
  return cap / font.unitsPerEm;
}

/** Proportional text, left-aligned; condenses then shrinks to fit maxWidth. */
function textPath(font: opentype.Font, raw: string, f: TextField, fill: string): string {
  let text = printable(font, raw);
  if (!text) return '';
  let glyphs = font.stringToGlyphs(text);
  const trackEm = VALUE_TRACKING;
  // Natural width at a given size: advances + kerning + tracking.
  const measure = (s: number) => {
    const unit = s / font.unitsPerEm;
    let w = 0;
    for (let i = 0; i < glyphs.length; i++) {
      w += (glyphs[i].advanceWidth ?? 0) * unit;
      if (i < glyphs.length - 1) w += font.getKerningValue(glyphs[i], glyphs[i + 1]) * unit + trackEm * s;
    }
    return w;
  };
  const fullSize = f.cap / capHeightRatio(font);
  let size = fullSize;
  let scaleX = VALUE_STRETCH;
  // Very long values: condense to 80%, shrink to no less than 72% of the
  // design size (still legible), then truncate with an ellipsis.
  const MIN_SIZE = 0.72;
  while (measure(fullSize) * VALUE_STRETCH * 0.8 * MIN_SIZE > f.maxWidth && text.length > 2) {
    text = text.replace(/…$/, '').slice(0, -1).trimEnd() + '…';
    glyphs = font.stringToGlyphs(text);
  }
  const natural = measure(size) * VALUE_STRETCH;
  if (natural > f.maxWidth) {
    const condense = Math.max(0.8, f.maxWidth / natural);    // first condense slightly
    scaleX = VALUE_STRETCH * condense;
    if (natural * condense > f.maxWidth) size *= f.maxWidth / (natural * condense); // then shrink
  }
  let x = 0;
  const parts: string[] = [];
  const unit = size / font.unitsPerEm;
  for (let i = 0; i < glyphs.length; i++) {
    parts.push(glyphs[i].getPath(x, 0, size).toPathData(2));
    x += (glyphs[i].advanceWidth ?? 0) * unit;
    if (i < glyphs.length - 1) x += font.getKerningValue(glyphs[i], glyphs[i + 1]) * unit + trackEm * size;
  }
  return `<path transform="translate(${f.x} ${f.baseline}) scale(${scaleX.toFixed(4)} 1)" fill="${fill}" stroke="${fill}" stroke-width="${(VALUE_STROKE / scaleX).toFixed(3)}" stroke-linejoin="round" d="${parts.join(' ')}"/>`;
}

/**
 * Keeps only characters the font can draw: accented letters it lacks fall
 * back to their base letter (e.g. a rare diacritic), anything else (emoji,
 * scripts outside Latin) is dropped instead of printing a missing-glyph box.
 */
function printable(font: opentype.Font, s: string): string {
  // hasChar() is true for the font's .notdef box too; glyph index 0 is .notdef.
  const drawable = (c: string) => font.charToGlyphIndex(c) > 0;
  return Array.from((s || '').normalize('NFC'))
    .map(ch => {
      if (/\s/.test(ch)) return ' ';
      if (/[̀-ͯ]/.test(ch)) return drawable(ch) ? ch : '';
      if (drawable(ch)) return ch;
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return base && Array.from(base).every(drawable) ? base : '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Monospace characters centred on a fixed cell grid (MRZ / serial). */
function gridPath(font: opentype.Font, text: string, grid: { firstCenter: number; pitch: number; baseline: number; cap: number }, fill: string, widthScale = 1, stroke = 0): string {
  const size = grid.cap / capHeightRatio(font);
  const parts: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') continue;
    const g = font.charToGlyph(ch);
    const adv = (g.advanceWidth ?? 0) * size / font.unitsPerEm * widthScale;
    const cx = grid.firstCenter + i * grid.pitch;
    const p = g.getPath(0, 0, size).toPathData(2);
    parts.push(`<path transform="translate(${(cx - adv / 2).toFixed(2)} ${grid.baseline}) scale(${widthScale} 1)" d="${p}"/>`);
  }
  const st = stroke ? ` stroke="${fill}" stroke-width="${stroke}" stroke-linejoin="round"` : '';
  return `<g fill="${fill}"${st}>${parts.join('')}</g>`;
}

// ── Ticket data ────────────────────────────────────────────────────────────
export interface VisaTicketData {
  ticketId: string;
  buyerName: string;
  tierName: string;
  /** ISO timestamp the ticket was issued (tickets.purchased_at). */
  issuedAt: string;
  /** 1-based, stable position of this ticket within the event's issuance order. */
  sequence: number;
}

/** Splits "Given Names Surname" (the order buyers enter it at checkout). */
export function splitName(full: string): { surname: string; given: string } {
  const clean = (full || '').trim();
  if (!clean || clean.includes('@')) return { surname: '', given: '' }; // email fallback — never invent a name
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { surname: parts[0].toUpperCase(), given: '' };
  return {
    surname: parts[parts.length - 1].toUpperCase(),
    given:   parts.slice(0, -1).join(' ').toUpperCase(),
  };
}

function lagosDateParts(iso: string) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  return { weekday: String(p.weekday).toUpperCase(), dd: p.day, mm: p.month, yyyy: p.year };
}

export function visaIdentity(t: VisaTicketData) {
  const seq = Math.max(1, t.sequence);
  const { weekday, dd, mm, yyyy } = lagosDateParts(t.issuedAt);
  const control = `YNA-IJGB-${String(seq).padStart(6, '0')}`;
  const serial  = `E${String(seq).padStart(7, '0')}`;
  // Same 49-cell shape as the reference MRZ line 2:
  // YNAIJGB + 10 digits << ENUGU << DDMMYYYY << EVENTCLOSE <<<
  const mrz2 = `YNAIJGB${String(seq).padStart(10, '0')}<<ENUGU<<${dd}${mm}${yyyy}<<EVENTCLOSE<<<`;
  return { control, serial, mrz2, issueDate: `${weekday} ${dd}/${mm}/${yyyy}` };
}

// ── Render ─────────────────────────────────────────────────────────────────
export async function renderVisaTicketJpeg(t: VisaTicketData): Promise<Buffer> {
  return (await renderVisaTicketImages(t)).full;
}

export interface VisaImages {
  /** 1920x1080 JPEG — goes into the PDF. */
  full: Buffer;
  /** 1200px-wide JPEG — inline in emails and on the ticket page. */
  preview: Buffer;
}

export async function renderVisaTicketImages(t: VisaTicketData): Promise<VisaImages> {
  const full = await renderVisaTicketFull(t);
  const sharp = (await import('sharp')).default;
  const preview = await sharp(full).resize(1200).jpeg({ quality: 80 }).toBuffer();
  return { full, preview };
}

async function renderVisaTicketFull(t: VisaTicketData): Promise<Buffer> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set — QR codes cannot be generated');
  // Clean the name to drawable characters BEFORE splitting, so e.g. a
  // trailing emoji can't become the "surname".
  const { surname, given } = splitName(printable(loadFonts().serifBold, t.buyerName));
  const id = visaIdentity(t);
  // Same payload as /api/tickets/[id]/qr, so the existing door scanner
  // verifies these tickets unchanged.
  return renderVisaFields(designForTier(t.tierName), {
    surname,
    given,
    idno:    t.ticketId.toUpperCase(),
    control: id.control,
    origin:  t.tierName.toUpperCase(),
    issue:   id.issueDate,
    serial:  id.serial,
    mrz2:    id.mrz2,
  }, `${appUrl}/scan/${t.ticketId}`);
}

export interface VisaFields {
  surname: string; given: string; idno: string; control: string;
  origin: string; issue: string; serial: string; mrz2: string;
}

/** Low-level: draws exactly these strings onto a design. */
export async function renderVisaFields(design: VisaDesign, v: VisaFields, qrPayload: string): Promise<Buffer> {
  const pal = PALETTES[design];
  const { serifBold, mono, serialMono } = loadFonts();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px(W)}" height="${px(H)}" viewBox="0 0 ${W} ${H}">
    ${textPath(serifBold, v.surname, FIELDS.surname, pal.ink)}
    ${textPath(serifBold, v.given, FIELDS.given, pal.ink)}
    ${textPath(serifBold, v.idno, FIELDS.idno, pal.ink)}
    ${textPath(serifBold, v.control, FIELDS.control, pal.ink)}
    ${textPath(serifBold, v.origin, FIELDS.origin, pal.ink)}
    ${textPath(serifBold, v.issue, FIELDS.issue, pal.ink)}
    ${gridPath(serialMono, v.serial, SERIAL, pal.serial, 0.86, 0.7)}
    ${gridPath(mono, v.mrz2.slice(0, MRZ2.cells), MRZ2, pal.mrz)}
  </svg>`;

  const qrPx = px(QR_BOX.size);
  const qr = await QRCode.toBuffer(qrPayload, {
    errorCorrectionLevel: 'H', margin: 2, width: qrPx, color: { dark: '#000000', light: '#ffffff' },
  });

  const sharp = (await import('sharp')).default;
  return withRenderSlot(async () => {
    const qrSized = await sharp(qr).resize(qrPx, qrPx, { kernel: 'nearest' }).png().toBuffer();
    return sharp(loadTemplate(design))
      .resize(px(W), px(H), { kernel: 'lanczos3' })
      .composite([
        { input: qrSized, left: px(QR_BOX.x), top: px(QR_BOX.y) },
        { input: Buffer.from(svg), left: 0, top: 0 },
      ])
      .jpeg({ quality: 85, chromaSubsampling: '4:4:4' })
      .toBuffer();
  });
}

// Renders are CPU/memory heavy (~20MB each). One serverless instance can
// serve many concurrent requests (e.g. a burst of checkouts), so cap how many
// run at once per instance; the rest queue briefly instead of exhausting
// memory.
const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;
const renderQueue: (() => void)[] = [];
async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    // Wait for a finishing render to hand its slot over directly.
    await new Promise<void>(resolve => renderQueue.push(resolve));
  } else {
    activeRenders++;
  }
  try {
    return await fn();
  } finally {
    const next = renderQueue.shift();
    if (next) next(); else activeRenders--;
  }
}

/**
 * Wraps one or more rendered visa JPEGs in a PDF (one landscape page each,
 * 16:9 at 960x540pt — the reference's 1280x720 at 96dpi). Built by hand: a
 * JPEG can be embedded in a PDF as-is (DCTDecode), so no PDF library needed.
 */
export function jpegsToPdf(jpegs: Buffer[]): Buffer {
  const PW = 960, PH = 540;
  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Buffer | string) => {
    const buf = typeof b === 'string' ? Buffer.from(b, 'latin1') : b;
    chunks.push(buf); len += buf.length;
  };
  const obj = (n: number, body: (Buffer | string)[]) => {
    offsets[n] = len;
    push(`${n} 0 obj\n`); body.forEach(push); push('\nendobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = jpegs.length;
  // 1 catalog, 2 pages, then per page: page, content, image
  const pageIds = jpegs.map((_, i) => 3 + i * 3);
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Count ${n} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`]);
  jpegs.forEach((jpg, i) => {
    const [pid, cid, iid] = [pageIds[i], pageIds[i] + 1, pageIds[i] + 2];
    const { w, h } = jpegSize(jpg);
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(pid, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>`]);
    obj(cid, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
    obj(iid, [
      `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
      jpg,
      '\nendstream',
    ]);
  });
  const total = 3 + n * 3;
  const xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

function jpegSize(b: Buffer): { w: number; h: number } {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    const segLen = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + segLen;
  }
  throw new Error('jpegSize: no SOF marker');
}

