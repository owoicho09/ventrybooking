export interface Socials {
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  snapchat?: string;
  whatsapp?: string;
}

const SOCIAL_ORDER: (keyof Socials)[] = ['instagram', 'twitter', 'tiktok', 'snapchat', 'whatsapp'];

const SOCIAL_LABELS: Record<keyof Socials, string> = {
  instagram: 'Instagram',
  twitter: 'X',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  whatsapp: 'WhatsApp',
};

// WhatsApp is stored as a raw phone number (organisers type it like a phone
// field, not a URL) — every other platform stores a full profile URL as-is.
function hrefFor(key: keyof Socials, value: string) {
  if (key === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`;
  return value;
}

const ICONS: Record<keyof Socials, React.ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
      <path d="M12 0C8.74 0 8.333.014 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.014-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.014 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zm0 5.836a6.006 6.006 0 100 12.012 6.006 6.006 0 000-12.012zM12 16a4 4 0 110-8 4 4 0 010 8zm7.846-10.405a1.441 1.441 0 100 2.883 1.441 1.441 0 000-2.883z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
      <path d="M16 3c.3 1.6 1.4 2.9 3 3.4v2.6c-1.1 0-2.1-.3-3-.9v5.4c0 3-2.4 5.4-5.4 5.4S5.2 16.5 5.2 13.5c0-2.8 2.1-5.1 4.8-5.4v2.7c-1.2.3-2 1.4-2 2.7 0 1.5 1.2 2.7 2.7 2.7s2.7-1.2 2.7-2.7V3H16z" />
    </svg>
  ),
  snapchat: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
      <path d="M12 2c-3 0-5 2.2-5 5.4 0 1 .1 1.9.2 2.6-.5.3-1.2.5-1.2 1.3 0 .6.5 1 1.1 1.2-.2 1.3-1 2.6-2.1 3.2-.4.2-.4.6 0 .8.3.2.7.3.6.7-.1.3-.5.4-.8.5-.3.1-.3.5.1.6.5.2 1 .3 1 .6 0 .2-.1.4.1.5.4.2 1 0 1.6 0 1 0 1.4.8 3.4.8s2.4-.8 3.4-.8c.6 0 1.2.2 1.6 0 .2-.1.1-.3.1-.5 0-.3.5-.4 1-.6.4-.1.4-.5.1-.6-.3-.1-.7-.2-.8-.5-.1-.4.3-.5.6-.7.4-.2.4-.6 0-.8-1.1-.6-1.9-1.9-2.1-3.2.6-.2 1.1-.6 1.1-1.2 0-.8-.7-1-1.2-1.3.1-.7.2-1.6.2-2.6C17 4.2 15 2 12 2z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .102 5.36.1 11.943c0 2.106.549 4.161 1.595 5.976L0 24l6.335-1.652a11.882 11.882 0 005.71 1.454h.005c6.582 0 11.943-5.36 11.946-11.944a11.86 11.86 0 00-3.475-8.409" />
    </svg>
  ),
};

export function SocialLinks({
  socials,
  organizerName,
  size = 'sm',
}: {
  socials?: Socials | null;
  /** When given, renders a "Follow {organizerName} across all platforms" heading above the icon row. */
  organizerName?: string;
  size?: 'sm' | 'md';
}) {
  if (!socials) return null;
  const entries = SOCIAL_ORDER.filter(key => socials[key]);
  if (entries.length === 0) return null;

  const dim = size === 'sm' ? 32 : 38;

  return (
    <div>
      {organizerName && (
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Follow {organizerName} across all platforms
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {entries.map(key => (
          <a
            key={key}
            href={hrefFor(key, socials[key]!)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={SOCIAL_LABELS[key]}
            title={SOCIAL_LABELS[key]}
            className="rounded-full border flex items-center justify-center transition-colors hover:border-[var(--color-purple)] hover:text-[var(--color-purple)]"
            style={{ width: dim, height: dim, borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-2)' }}
          >
            <span style={{ width: dim * 0.45, height: dim * 0.45 }}>{ICONS[key]}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
