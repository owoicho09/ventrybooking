import QRCode from 'qrcode';
import { QR_WORDMARK_PNG_BASE64, QR_WORDMARK_SIZE } from '@/lib/server/qrWordmark';

/**
 * Ticket QR codes, in the Ventry design: black modules, purple corner
 * (finder) squares with black centres, and the VENTRY wordmark in a cleared
 * white space in the middle.
 *
 * What scanners need is untouched: dark-on-light contrast, the three finder
 * patterns' 1:1:3:1:1 proportions (only their outer ring is purple, which is
 * still far darker than the white), a 4-module white quiet zone, and the
 * payload itself. The centre clearing is ~6% of the code; error correction
 * level H restores up to ~30%.
 *
 * If anything in the branded path fails, the plain black-and-white code is
 * returned instead, so a ticket is never left without a working QR.
 */

const PLAIN_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 2,
  width: 300,
  color: { dark: '#000000', light: '#ffffff' },
};

const INK = '#0f0e14';
const PURPLE = '#7c22ef';
const QUIET = 4;          // modules of white margin (the QR standard)
const OUTPUT_PX = 600;    // crisp on phones and in emails, still small

/** The branded code as SVG (exported for tests and previews). */
export function brandedQRSvg(data: string, px = OUTPUT_PX): string {
  const qr = QRCode.create(data, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const dark = (r: number, c: number) => qr.modules.get(r, c) === 1;
  const total = n + QUIET * 2;

  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  // Centre clearing for the wordmark. Versions 7+ put an alignment pattern
  // at the very centre; those never get the clearing (ticket links are v6).
  const withMark = qr.version < 7;
  const odd = (x: number) => (x % 2 === 0 ? x + 1 : x);
  const zw = withMark ? odd(Math.round(n * 0.36)) : 0;
  const zh = withMark ? odd(Math.round(n * 0.18)) : 0;
  const zc = Math.floor((n - zw) / 2), zr = Math.floor((n - zh) / 2);
  const inZone = (r: number, c: number) => withMark && r >= zr && r < zr + zh && c >= zc && c < zc + zw;

  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (dark(r, c) && !isFinder(r, c) && !inZone(r, c)) path += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }
  }

  const finder = (r0: number, c0: number) => {
    const x = c0 + QUIET, y = r0 + QUIET;
    return `<rect x="${x}" y="${y}" width="7" height="7" fill="${PURPLE}"/>`
      + `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#ffffff"/>`
      + `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="${INK}"/>`;
  };

  let mark = '';
  if (withMark) {
    const pad = 0.6;
    const boxW = zw - pad * 2, boxH = zh - pad * 2;
    const ratio = QR_WORDMARK_SIZE.width / QR_WORDMARK_SIZE.height;
    const w = Math.min(boxW, boxH * ratio), h = w / ratio;
    const x = QUIET + zc + (zw - w) / 2, y = QUIET + zr + (zh - h) / 2;
    mark = `<image x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${QR_WORDMARK_PNG_BASE64}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}">`
    + `<rect width="${total}" height="${total}" fill="#ffffff"/>`
    + `<path d="${path}" fill="${INK}" shape-rendering="crispEdges"/>`
    + finder(0, 0) + finder(0, n - 7) + finder(n - 7, 0)
    + mark
    + `</svg>`;
}

async function brandedPng(data: string): Promise<Buffer> {
  // Lazy: sharp is a native module; importing it at module scope once took
  // down every route that touched this file when its binary failed to load.
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(brandedQRSvg(data))).png().toBuffer();
}

export async function generateQRBuffer(data: string): Promise<Buffer> {
  try {
    return await brandedPng(data);
  } catch (err) {
    console.error('generateQRBuffer: branded QR failed, using plain', err);
    return QRCode.toBuffer(data, PLAIN_OPTIONS);
  }
}

export async function generateQRDataUrl(data: string): Promise<string> {
  try {
    return `data:image/png;base64,${(await brandedPng(data)).toString('base64')}`;
  } catch (err) {
    console.error('generateQRDataUrl: branded QR failed, using plain', err);
    return QRCode.toDataURL(data, PLAIN_OPTIONS);
  }
}
