// Client-side only — reads pixel data off a canvas that already has the
// organiser's cropped flyer/banner drawn onto it (see BannerCropInput), so no
// extra image fetch or library is needed.

interface RGB { r: number; g: number; b: number }

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function rgbToHsl({ r, g, b }: RGB): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn: h = 60 * (((gn - bn) / d) % 6); break;
      case gn: h = 60 * ((bn - rn) / d + 2); break;
      default: h = 60 * ((rn - gn) / d + 4);
    }
  }
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/**
 * Darkens (in HSL lightness) an arbitrary extracted colour until it clears
 * WCAG AA (4.5:1) as a solid fill under white button text — the same bar the
 * hand-picked ACCENT_COLOR_PRESETS palette already guarantees. An extracted
 * colour that's too pale/light otherwise wouldn't be safe to use the same way.
 */
export function ensureAccessibleAccent(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const white: RGB = { r: 255, g: 255, b: 255 };
  if (contrastRatio(rgb, white) >= 4.5) return hex;

  let [h, s, l] = rgbToHsl(rgb);
  // Nudge saturation up a little for washed-out photo colours, then step
  // lightness down until the contrast bar clears.
  s = Math.max(s, 0.45);
  for (let i = 0; i < 20 && l > 0.05; i++) {
    l -= 0.04;
    const candidate = hslToRgb(h, s, l);
    if (contrastRatio(candidate, white) >= 4.5) return rgbToHex(candidate);
  }
  return rgbToHex(hslToRgb(h, s, 0.28)); // safe fallback lightness
}

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/**
 * Picks a dominant, reasonably vivid colour out of a canvas — downsamples to
 * a small grid, buckets pixels by quantized RGB, and returns the most
 * frequent bucket that isn't close to white/black/grey (those are almost
 * always background, not brand colour). Returns null if nothing vivid enough
 * is found (e.g. a greyscale image) so the caller can leave the accent unset.
 */
export function extractDominantColor(source: HTMLCanvasElement): string | null {
  const SAMPLE = 48;
  const sampler = document.createElement('canvas');
  sampler.width = SAMPLE;
  sampler.height = SAMPLE;
  const ctx = sampler.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, SAMPLE, SAMPLE);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null; // canvas tainted by a cross-origin source — skip silently
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const QUANT = 24;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 200) continue;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const isNearGreyOrExtreme = (max - min < 18) || max < 40 || min > 235;
    if (isNearGreyOrExtreme) continue; // skip background-y greys/near-white/near-black

    const key = `${Math.round(r / QUANT)},${Math.round(g / QUANT)},${Math.round(b / QUANT)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best || best.count < 4) return null; // not enough vivid signal — leave it unset

  const avg: RGB = { r: best.r / best.count, g: best.g / best.count, b: best.b / best.count };
  return ensureAccessibleAccent(rgbToHex(avg));
}
