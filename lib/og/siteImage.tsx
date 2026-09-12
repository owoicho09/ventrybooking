// Shared site-wide OG card JSX, used by app/opengraph-image.tsx (the
// site-wide fallback) and as the last-resort fallback in
// app/[slug]/opengraph-image.tsx when a slug matches neither an event nor
// an organiser handle. Kept as a plain JSX factory rather than baked into
// either file so neither has to import from the other.

// fetch(new URL(...)) against a local /public asset is a build-time-inlined
// reference under next/og's edge runtime, not a real network call — the
// documented way to get a local image into an ImageResponse.
export async function getLogoDataUri(): Promise<string> {
  const buf = await fetch(new URL('../../public/logo.jpg', import.meta.url)).then(r => r.arrayBuffer());
  return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
}

export function SiteOGCard({ logoSrc }: { logoSrc?: string } = {}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0f',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(124,58,237,0.35) 0%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: '100px',
            padding: '8px 20px',
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a855f7' }} />
          <span style={{ color: '#a855f7', fontSize: '20px', fontWeight: 600, letterSpacing: '0.05em' }}>
            Nigeria&apos;s trust-first ticketing platform
          </span>
        </div>
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            width={420}
            height={420}
            alt="Ventry"
            style={{ borderRadius: '28px', border: '1px solid rgba(124,58,237,0.4)' }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {['Secure Payments', 'Verified Organizers', 'QR Tickets'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                padding: '6px 14px',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '16px',
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '20px', letterSpacing: '0.05em' }}>
          ventrybooking.com
        </span>
      </div>
    </div>
  );
}
