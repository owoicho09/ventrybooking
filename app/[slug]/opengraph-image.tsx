import { ImageResponse } from 'next/og';
import { getServerSupabase } from '@/lib/supabase/server';
import { SiteOGCard } from '@/lib/og/siteImage';

export const runtime = 'edge';
export const alt = 'Event on Ventry';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function getEventForCard(slug: string) {
  const db = getServerSupabase();
  const { data } = await db
    .from('events')
    .select('event_name, date, banner_url, banner_color, accent_color, status, organizer:users!events_organizer_id_fkey(name, avatar_url)')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return null;
  const organizer = Array.isArray(data.organizer) ? data.organizer[0] : data.organizer;
  return { ...data, organizer: organizer as { name: string; avatar_url: string | null } | null };
}

async function getOrganizerForCard(handle: string) {
  const db = getServerSupabase();
  const { data } = await db
    .from('users')
    .select('name, bio, avatar_url')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();
  return data;
}

function formatCardDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default async function EventOGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  {
    const event = await getEventForCard(slug);
    if (event && event.status === 'approved') {
      const accent = event.accent_color || '#7c3aed';
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              position: 'relative',
              backgroundColor: '#0a0a0f',
              overflow: 'hidden',
            }}
          >
            {event.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.banner_url}
                alt=""
                width={1200}
                height={630}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, #4c1d95 0%, #312e81 100%)',
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.35) 55%, rgba(10,10,15,0.05) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '40px',
                left: '48px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '28px',
                fontWeight: 800,
              }}
            >
              <span style={{ color: '#a855f7' }}>V</span>
              <span style={{ color: '#fff' }}>ENTRY</span>
            </div>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                padding: '48px',
              }}
            >
              {event.organizer?.name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {event.organizer.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.organizer.avatar_url}
                      alt=""
                      width={36}
                      height={36}
                      style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.8)' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '18px',
                        fontWeight: 700,
                        border: '2px solid rgba(255,255,255,0.8)',
                      }}
                    >
                      {event.organizer.name[0]}
                    </div>
                  )}
                  <span style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                    By {event.organizer.name}
                  </span>
                </div>
              )}
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 800,
                  color: '#fff',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  maxWidth: '1000px',
                }}
              >
                {event.event_name}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                {formatCardDate(event.date)}
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', backgroundColor: accent }} />
          </div>
        ),
        { ...size },
      );
    }
  }

  const organizer = await getOrganizerForCard(slug);
  if (organizer) {
    return new ImageResponse(
      (
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
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '0 80px', textAlign: 'center' }}>
            {organizer.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organizer.avatar_url}
                alt=""
                width={140}
                height={140}
                style={{ borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,0.85)' }}
              />
            ) : (
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  backgroundColor: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '64px',
                  fontWeight: 800,
                  border: '4px solid rgba(255,255,255,0.85)',
                }}
              >
                {organizer.name[0]}
              </div>
            )}
            <div style={{ fontSize: '52px', fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {organizer.name}
            </div>
            {organizer.bio && (
              <div style={{ fontSize: '26px', fontWeight: 400, color: 'rgba(255,255,255,0.75)', maxWidth: '820px' }}>
                {organizer.bio.slice(0, 120)}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', fontSize: '22px', fontWeight: 700 }}>
              <span style={{ color: '#a855f7' }}>V</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>ENTRY ORGANISER</span>
            </div>
          </div>
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(<SiteOGCard />, { ...size });
}
