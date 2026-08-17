// Shared site-wide OG card JSX, used by app/opengraph-image.tsx (the
// site-wide fallback) and as the last-resort fallback in
// app/[slug]/opengraph-image.tsx when a slug matches neither an event nor
// an organiser handle. Kept as a plain JSX factory rather than baked into
// either file so neither has to import from the other.
export function SiteOGCard() {
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
          gap: '24px',
          padding: '0 80px',
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
        <div style={{ fontSize: '120px', fontWeight: 800, color: '#7c3aed', lineHeight: 1, letterSpacing: '-0.03em' }}>
          VENTRY
        </div>
        <div style={{ fontSize: '32px', fontWeight: 400, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.01em' }}>
          Secure Event Ticketing for Nigeria
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginTop: '12px' }}>
          {['Escrow Protected', 'Verified Organizers', 'QR Tickets', 'Auto Refunds'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '18px',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: '36px', color: 'rgba(255,255,255,0.3)', fontSize: '20px', letterSpacing: '0.05em' }}>
        ventrybooking.com
      </div>
    </div>
  );
}
