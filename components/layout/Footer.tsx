import '@/app/v2.css';
import Link from 'next/link';

interface FooterProps {
  /** Busiest cities, linked into the browse page. Optional — omitted when not known. */
  cities?: string[];
  /** Drop the top margin when the section above already supplies the spacing. */
  flush?: boolean;
}

export function Footer({ cities = [], flush = false }: FooterProps) {
  return (
    <footer className="v2 v-footer" style={flush ? undefined : { marginTop: 80 }}>
      <div className="v-wrap">
        <div className="v-fgrid">
          <div style={{ maxWidth: 260 }}>
            <Link href="/" className="v-logo" style={{ display: 'inline-block', marginBottom: 10 }}><span>V</span>ENTRY</Link>
            <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Secure event ticketing for Nigeria.</p>
          </div>
          <div className="v-fcols">
            <div className="v-fcol">
              <h5>Discover</h5>
              <Link href="/events">All events</Link>
              {cities.slice(0, 3).map(c => (
                <Link key={c} href={`/events?city=${encodeURIComponent(c)}`}>{c}</Link>
              ))}
              <Link href="/blog">Blog</Link>
            </div>
            <div className="v-fcol">
              <h5>Organisers</h5>
              <Link href="/organizer/register">List an event</Link>
              <Link href="/terms/organisers">Organiser terms</Link>
              <Link href="/affiliates">Affiliates</Link>
              <Link href="/signin">Organiser sign in</Link>
            </div>
            <div className="v-fcol">
              <h5>Help</h5>
              <Link href="/retrieve">Retrieve a ticket</Link>
              <Link href="/help">Support</Link>
              <Link href="/terms/refunds">Refunds</Link>
              <Link href="/terms/buyers">Buyer terms</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </div>
        <div className="v-fbot">
          <span>© {new Date().getFullYear()} Ventry Solutions · RC BN9586934</span>
          <span>Abuja, Nigeria</span>
        </div>
      </div>
    </footer>
  );
}
