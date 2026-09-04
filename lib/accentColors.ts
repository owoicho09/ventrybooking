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
