export interface Socials {
  instagram?: string;
  twitter?: string;
  facebook?: string;
  snapchat?: string;
  tiktok?: string;
  website?: string;
}

const SOCIAL_ORDER: (keyof Socials)[] = ['instagram', 'twitter', 'facebook', 'snapchat', 'tiktok', 'website'];

const SOCIAL_LABELS: Record<keyof Socials, string> = {
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
  tiktok: 'TikTok',
  website: 'Website',
};

/**
 * Shown as plain text pills rather than brand icons — the installed
 * lucide-react build has no Facebook/Instagram/Twitter/Snapchat/TikTok
 * marks, and a text label reads clearly regardless, which matters here
 * since organisers are counting on this for buyer-facing credibility.
 */
export function SocialLinks({ socials, size = 'sm' }: { socials?: Socials | null; size?: 'sm' | 'md' }) {
  if (!socials) return null;
  const entries = SOCIAL_ORDER.filter(key => socials[key]);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(key => (
        <a
          key={key}
          href={socials[key]}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-full border transition-colors hover:border-[var(--color-purple)] ${size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5'}`}
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          {SOCIAL_LABELS[key]}
        </a>
      ))}
    </div>
  );
}
