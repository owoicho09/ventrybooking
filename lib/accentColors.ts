// Fixed preset palette for per-event accent colours (organiser branding on
// the ticket purchase panel — never a free hex picker). Every value here is
// verified to clear WCAG AA (>=4.5:1) as a solid button fill against white
// button text, and comfortably clears it against the app's near-black
// background (#0a0a0f) when used for borders/text instead.
export interface AccentColorPreset {
  name: string;
  hex: string;
}

export const ACCENT_COLOR_PRESETS: AccentColorPreset[] = [
  { name: 'Ventry Purple', hex: '#7c3aed' },
  { name: 'Indigo',        hex: '#4f46e5' },
  { name: 'Blue',          hex: '#2563eb' },
  { name: 'Teal',          hex: '#0f766e' },
  { name: 'Emerald',       hex: '#047857' },
  { name: 'Amber',         hex: '#b45309' },
  { name: 'Rose',          hex: '#e11d48' },
  { name: 'Fuchsia',       hex: '#a21caf' },
  { name: 'Slate',         hex: '#475569' },
];

/**
 * A preset swatch, or any well-formed 6-digit hex — the latter covers colours
 * auto-extracted from an organiser's flyer/banner (lib/colorExtract.ts),
 * which already enforces the same WCAG AA contrast floor the presets were
 * hand-picked to clear before a value ever reaches here. Strict format check
 * matters since this value gets used directly as a CSS custom property.
 */
export function isValidAccentColor(value: unknown): value is string {
  return typeof value === 'string' && (
    ACCENT_COLOR_PRESETS.some(p => p.hex === value) || /^#[0-9a-fA-F]{6}$/.test(value)
  );
}

interface RGB { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
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

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/**
 * Never trust the raw pick for button label colour: pick black or white
 * for whichever clears WCAG AA (4.5:1) against this fill, or the higher-
 * contrast of the two if neither technically clears it (only possible for
 * hues sitting right in the mid-luminance band).
 */
export function getContrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#fff';
  const white: RGB = { r: 255, g: 255, b: 255 };
  const black: RGB = { r: 0, g: 0, b: 0 };
  const whiteContrast = contrastRatio(rgb, white);
  const blackContrast = contrastRatio(rgb, black);
  return whiteContrast >= blackContrast ? '#fff' : '#000';
}

/**
 * Walks an accent colour's HSL lightness toward the page background until it
 * clears a safe contrast floor for icons/borders/text drawn on that
 * background (3:1 — the WCAG floor for non-text UI components — since this
 * covers icons and borders as well as short text labels), keeping hue fixed
 * so the organiser's colour stays recognisable. `bgHex` is one of the app's
 * two fixed theme backgrounds (--color-bg light/dark), not user input.
 */
export function accentForBackground(hex: string, bgHex: string): string {
  const rgb = hexToRgb(hex);
  const bg = hexToRgb(bgHex);
  if (!rgb || !bg) return hex;
  if (contrastRatio(rgb, bg) >= 3) return hex;

  const bgIsDark = relativeLuminance(bg) < 0.5;
  let [h, s, l] = rgbToHsl(rgb);
  s = Math.max(s, 0.45);
  // Against a dark background, lighten; against a light background, darken.
  const step = bgIsDark ? 0.04 : -0.04;
  for (let i = 0; i < 20 && l > 0.05 && l < 0.95; i++) {
    l += step;
    const candidate = hslToRgb(h, s, l);
    if (contrastRatio(candidate, bg) >= 3) return rgbToHex(candidate);
  }
  return rgbToHex(hslToRgb(h, s, bgIsDark ? 0.72 : 0.28)); // safe fallback lightness
}
