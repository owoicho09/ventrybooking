import './v2.css';
import Link from 'next/link';
import { EventImage } from '@/components/v2/EventImage';
import { OrganiserMarquee } from '@/components/v2/OrganiserMarquee';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { DragRail } from '@/components/v2/DragRail';
import { EventCardV2 } from '@/components/v2/EventCardV2';
import { SettlementScrub } from '@/components/landing/SettlementScrub';
import { HeroDeck } from '@/components/landing/HeroDeck';
import { getPublicEvents, getPlatformFigures, cityCounts, organizerSummaries } from '@/lib/server/publicEvents';
import { eventImages, fmtDay, fmtShortDay, locationLine, naira, outcomeLabel, todayWAT, type PublicEvent } from '@/lib/publicEvents';
import { accentForBackground, getContrastText } from '@/lib/accentColors';

// Fresh enough for live counts, without a database round trip per visitor.
export const revalidate = 60;

const PHONE_BG = '#0D0A16';

/** Strongest real outcome first: sold out, then door count, then tickets. */
function outcomeScore(e: PublicEvent) {
  return (e.soldOut ? 1e9 : 0) + e.checkedIn * 1000 + e.totalSold;
}

export default async function HomePage() {
  const [events, figures] = await Promise.all([getPublicEvents(), getPlatformFigures()]);
  const today = todayWAT();

  const upcoming = events
    .filter(e => e.status === 'approved' && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = events
    .filter(e => e.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  // Hero: real past flyers with real outcomes; topped up with on-sale flyers
  // only if there aren't three finished events with artwork yet.
  const heroCards = [
    ...[...past].filter(e => eventImages(e).length).sort((a, b) => outcomeScore(b) - outcomeScore(a)),
    ...upcoming.filter(e => eventImages(e).length),
  ].slice(0, 3);

  const cities = cityCounts(events).slice(0, 5);
  const organisers = organizerSummaries(events);

  // Story cards are built from real events, never sample data.
  const showcase = upcoming.find(e => eventImages(e).length) ?? upcoming[0] ?? past.find(e => eventImages(e).length) ?? past[0] ?? null;
  const showcasePortrait = showcase ? eventImages(showcase) : [];
  const showcaseWide = showcase ? eventImages(showcase, 'wide') : [];
  const showcaseAccent = accentForBackground(showcase?.accentColor || '#7c3aed', PHONE_BG);
  const showcaseTiers = showcase ? [...showcase.tiers].sort((a, b) => a.price - b.price).slice(0, 2) : [];
  const statsEvent = [...past].sort((a, b) => (b.checkedIn - a.checkedIn) || (b.totalSold - a.totalSold))[0] ?? null;

  // Marquee: at least three real organisers, track repeated so it never gaps.
  const showMarquee = organisers.length >= 3;

  return (
    <div className="v2">
      <PublicNav />
      <div className="v-nav-spacer" />

      {/* ── Hero ── */}
      <header className="v-hero">
        <div className="v-hero-grid">
          <div>
            <h1>Every experience, one ticket away.</h1>
            <p className="v-hero-sub">
              Buy tickets to parties, concerts and conferences with a QR code that can&apos;t be faked. List your own in minutes.
            </p>
            <div className="v-hero-btns">
              <Link className="v-btn v-btn-solid v-btn-lg" href="/events">Discover events</Link>
              <Link className="v-btn v-btn-ghost v-btn-lg" href="/organizer/register">List your event</Link>
            </div>
            <p className="v-hero-note">Free to list. Organisers are paid the next working day, and keep 97% of every ticket.</p>
          </div>
          {heroCards.length > 0 && (
            <HeroDeck
              cards={heroCards.map(e => ({
                id: e.id,
                href: `/${e.slug}`,
                name: e.name,
                location: locationLine(e),
                badge: e.status === 'completed' ? outcomeLabel(e) : 'On sale now',
                images: eventImages(e),
              }))}
            />
          )}
        </div>
      </header>

      {/* City strip (cities with event counts + tickets this month) is hidden
          for now; the .v-strip styles in v2.css are kept for when it returns. */}

      {/* ── On sale now ── */}
      <section className="v-sec" style={{ paddingBottom: 40 }}>
        <div className="v-wrap v-sec-head">
          <div>
            <h2>{upcoming.length ? 'On sale now' : 'Recently on Ventry'}</h2>
            <p>{upcoming.length ? 'Verified events from organisers who’ve been checked.' : 'Nothing is on sale this minute. Here’s what just happened.'}</p>
          </div>
          <Link className="v-seeall" href="/events">Browse all events</Link>
        </div>
        <DragRail label="Events on sale">
          {(upcoming.length ? upcoming : past.slice(0, 6)).map((e, i) => (
            <EventCardV2 key={e.id} event={e} priority={i < 2} sizes="(max-width: 900px) 226px, 272px" />
          ))}
        </DragRail>
      </section>

      {/* ── Sticky stacked story cards ── */}
      <section className="v-stack-sec" id="how-it-works">
        <div className="v-stack-intro">
          <h2>What happens after someone taps buy</h2>
          <p>Four things Ventry does between a flyer and a full room.</p>
        </div>
        <div className="v-stack-list">
          <article className="v-scard" style={{ '--i': 0 } as React.CSSProperties}>
            <div className="v-scard-tab"><span className="v-tab-i">1</span><span>Your page, your brand</span></div>
            <div className="v-scard-in">
              <div>
                <h3>An event page that looks like yours</h3>
                <p className="lead">Your banner stays fixed at the top. Your colour runs through the ticket tiers and the buy button. Buyers remember you, not us.</p>
                <ul className="v-ticks">
                  <li><span className="v-tk">✓</span>Wide banner plus your flyer</li>
                  <li><span className="v-tk">✓</span>Your accent colour across the page</li>
                  <li><span className="v-tk">✓</span>ventrybooking.com/your-event-name</li>
                </ul>
              </div>
              {showcase && (
                <div className="v-mock" style={{ '--acc': showcaseAccent, '--acc-fg': getContrastText(showcaseAccent) } as React.CSSProperties}>
                  <div className="v-phone-wrap">
                  {showcasePortrait.length > 0 && (
                    <div className="v-float-poster"><EventImage sources={showcasePortrait} sizes="94px" /></div>
                  )}
                  <Link href={`/${showcase.slug}`} className="v-phone" aria-label={`See ${showcase.name}`}>
                    <div className="v-ph-banner">
                      <EventImage sources={showcaseWide} sizes="214px" style={{ objectFit: 'cover', objectPosition: 'center top' }} />
                    </div>
                    <div className="v-ph-body">
                      <div className="v-ph-t">{showcase.name}</div>
                      <div className="v-ph-m">{fmtShortDay(showcase.date)} · {locationLine(showcase)}</div>
                      {showcaseTiers.map((t, i) => (
                        <div key={t.id} className={`v-ph-tier${i === 0 ? ' on' : ''}`}>
                          <span>{t.name}</span><b>{t.price === 0 ? 'Free' : naira(t.price)}</b>
                        </div>
                      ))}
                      <div className="v-ph-btn">Get tickets</div>
                    </div>
                  </Link>
                  </div>
                </div>
              )}
            </div>
          </article>

          <article className="v-scard" style={{ '--i': 1 } as React.CSSProperties}>
            <div className="v-scard-tab"><span className="v-tab-i">2</span><span>The ticket lands</span></div>
            <div className="v-scard-in">
              <div>
                <h3>In their inbox before they close the tab</h3>
                <p className="lead">A branded confirmation with the flyer at the top and a QR that only works once. Reminders go out before doors open.</p>
                <ul className="v-ticks">
                  <li><span className="v-tk">✓</span>Sent in the event&apos;s name, not ours</li>
                  <li><span className="v-tk">✓</span>Lost it? Recover it at /retrieve</li>
                  <li><span className="v-tk">✓</span>Saved to their Ventry account too</li>
                </ul>
              </div>
              {showcase && (
                <div className="v-mock">
                  <div className="v-mail">
                    <div className="v-mail-h">{showcase.name} · your ticket</div>
                    {showcaseWide.length > 0 && (
                      <div className="v-mail-flyer" style={{ position: 'relative' }}><EventImage sources={showcaseWide} sizes="260px" style={{ objectFit: 'cover', objectPosition: 'center top' }} /></div>
                    )}
                    <div className="v-mail-b">
                      <h5>You&apos;re in.</h5>
                      <p>
                        1 {showcaseTiers[0]?.name ?? 'General'} ticket · {fmtDay(showcase.date)}{showcase.time ? `, ${showcase.time}` : ''}
                        <br />{locationLine(showcase)}
                      </p>
                      <div className="v-mail-cta">View your QR ticket</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </article>

          <article className="v-scard" style={{ '--i': 2 } as React.CSSProperties}>
            <div className="v-scard-tab"><span className="v-tab-i">3</span><span>At the door</span></div>
            <div className="v-scard-in">
              <div>
                <h3>Tickets that can&apos;t be copied</h3>
                <p className="lead">Your own staff scan with their phones under named staff links. Screenshots and forwards are rejected on the spot, and you can see who admitted whom.</p>
                <ul className="v-ticks">
                  <li><span className="v-tk">✓</span>Validated live, one scan per ticket</li>
                  <li><span className="v-tk">✓</span>No scanners to rent or buy</li>
                  <li><span className="v-tk">✓</span>Live check-in count as doors run</li>
                </ul>
              </div>
              <div className="v-mock">
                <div className="v-scan" role="img" aria-label="A ticket being admitted by the door scanner">
                  <div className="v-scan-box">
                    <i className="v-corner v-c1" /><i className="v-corner v-c2" /><i className="v-corner v-c3" /><i className="v-corner v-c4" />
                    <svg width="74" height="74" viewBox="0 0 29 29" shapeRendering="crispEdges" opacity=".92" aria-hidden="true">
                      <g fill="#10B981">
                        <path d="M0 0h7v7H0zM22 0h7v7h-7zM0 22h7v7H0z" opacity=".3" />
                        <path d="M2 2h3v3H2zM24 2h3v3h-3zM2 24h3v3H2z" />
                        <path d="M9 9h2v2H9zM14 10h2v1h-2zM19 12h1v2h-1zM12 15h1v1h-1zM16 16h1v2h-1zM10 19h2v1h-2zM15 20h2v1h-2zM22 16h1v1h-1zM25 19h1v1h-1zM12 12h2v1h-2z" />
                      </g>
                    </svg>
                  </div>
                  <div className="v-scan-ok">Admitted</div>
                  <div className="v-scan-sub">{showcaseTiers[0]?.name ?? 'Regular'} · scanned at the door</div>
                </div>
              </div>
            </div>
          </article>

          <article className="v-scard" style={{ '--i': 3 } as React.CSSProperties}>
            <div className="v-scard-tab"><span className="v-tab-i">4</span><span>Your money</span></div>
            <div className="v-scard-in">
              <div>
                <h3>Sales land live, settlement lands next day</h3>
                <p className="lead">Tickets sold, revenue and tier breakdown update as buyers pay. Each working day&apos;s sales are settled the next working day.</p>
                <ul className="v-ticks">
                  <li><span className="v-tk">✓</span>Full attendee list, exportable</li>
                  <li><span className="v-tk">✓</span>Named links to track each promoter</li>
                  <li><span className="v-tk">✓</span>Settlement history, in and out</li>
                </ul>
              </div>
              {statsEvent && (
                <div className="v-mock">
                  <div className="v-panel">
                    <div className="v-panel-t"><b>{statsEvent.name}</b> · final numbers</div>
                    <div className="v-dash-top">
                      <div className="v-stat"><div className="l">Tickets sold</div><div className="v">{statsEvent.totalSold.toLocaleString('en-NG')}</div></div>
                      <div className="v-stat"><div className="l">Checked in</div><div className="v g">{statsEvent.checkedIn.toLocaleString('en-NG')}</div></div>
                    </div>
                    <table>
                      <thead><tr><th>Tier</th><th>Sold</th><th>Status</th></tr></thead>
                      <tbody>
                        {[...statsEvent.tiers].sort((a, b) => b.sold - a.sold).slice(0, 4).map(t => (
                          <tr key={t.id}>
                            <td>{t.name}</td>
                            <td>{t.sold.toLocaleString('en-NG')}</td>
                            <td>{t.sold >= t.available ? <span className="v-pill-ok">Sold out</span> : <span className="v-pill-n">Closed</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* ── Scroll-scrubbed settlement ── */}
      {figures.settledTotal > 0 && <SettlementScrub total={figures.settledTotal} id="for-organisers" />}

      {/* ── Purple break ── */}
      <section className="v-break" id={figures.settledTotal > 0 ? undefined : 'for-organisers'}>
        <div className="v-break-in">
          <div>
            <h2>Sell today. Paid tomorrow.</h2>
            <p>No listing fee, no subscription, no waiting until after your event. If nothing sells, nothing is owed.</p>
          </div>
          <Link className="v-btn v-btn-white v-btn-lg" href="/organizer/register">Start selling</Link>
        </div>
      </section>

      {/* ── Follow an organiser ── */}
      {showMarquee && (
        <section className="v-sec">
          <div className="v-wrap">
            <div className="v-sec-head">
              <div>
                <h2>Follow an organiser</h2>
                <p>Every one verified before their first ticket sells. Tap in to see what they&apos;re running next.</p>
              </div>
            </div>
            <OrganiserMarquee organisers={organisers} />
          </div>
        </section>
      )}

      {/* ── Recently on Ventry: a horizontal rail, like On sale now ── */}
      {past.length > 0 && upcoming.length > 0 && (
        <section className="v-sec" style={showMarquee ? { paddingTop: 0 } : undefined}>
          <div className="v-wrap v-sec-head">
            <div>
              <h2>Recently on Ventry</h2>
              <p>{past.some(e => e.rating) ? 'Rated by the people who were actually in the room.' : 'Events that sold, scanned and happened.'}</p>
            </div>
            <Link className="v-seeall" href="/events">See past events</Link>
          </div>
          <DragRail label="Recent events">
            {past.slice(0, 10).map(e => (
              <EventCardV2 key={e.id} event={e} sizes="(max-width: 900px) 226px, 272px" />
            ))}
          </DragRail>
        </section>
      )}

      {/* ── FAQ ── */}
      <section className="v-sec" style={{ paddingTop: 0 }}>
        <div className="v-narrow v-faq">
          <h2>Questions people ask</h2>
          <details open>
            <summary>When do organisers get paid?</summary>
            <p>Each working day&apos;s sales are settled the next working day, net of the platform fee. No waiting until after the event.</p>
          </details>
          <details>
            <summary>What does Verified mean?</summary>
            <p>The organiser&apos;s identity has been checked, and venue documentation was reviewed before the event went live. A photo of a venue is not accepted as proof of a booking.</p>
          </details>
          <details>
            <summary>I lost my ticket. What now?</summary>
            <p>Recover it yourself at <Link href="/retrieve">ventrybooking.com/retrieve</Link> using the details you bought with, or ask the support chat and it will be sent back to your purchase email.</p>
          </details>
          <details>
            <summary>Who handles refunds?</summary>
            <p>The organiser pays refunds under the policy published on their event page. Ventry refunds automatically only where it still holds the money for a cancelled event. <Link href="/terms/buyers#refunds-claims">How refunds work</Link>.</p>
          </details>
          <details>
            <summary>What does it cost to list?</summary>
            <p>Nothing upfront. No listing fee, no subscription. Ventry takes 3% at settlement, so if nothing sells, nothing is owed.</p>
          </details>
        </div>
      </section>

      <Footer cities={cities.map(c => c.city)} flush />
    </div>
  );
}
