import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';

export interface TocEntry {
  id: string;
  label: string;
}

export function LegalLayout({
  eyebrow = 'Legal',
  title,
  version,
  effective,
  toc,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  version: string;
  effective: string;
  toc: TocEntry[];
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />

      <div
        className="border-b pt-24 pb-12 px-6"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-purple-light)' }}>
            {eyebrow}
          </p>
          <h1
            className="text-4xl sm:text-5xl font-extrabold mb-4"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
          >
            {title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Version <strong style={{ color: 'var(--color-text)' }}>{version}</strong>
            &ensp;·&ensp;Effective <strong style={{ color: 'var(--color-text)' }}>{effective}</strong>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex flex-col lg:flex-row gap-12">
          <aside className="lg:w-56 flex-shrink-0">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-dim)' }}>
                Contents
              </p>
              <nav className="flex flex-col gap-2">
                {toc.map(({ id, label }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="text-xs leading-snug hover:underline"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="flex-1 flex flex-col gap-12 min-w-0">
            <div
              className="rounded-xl border p-5 text-sm leading-relaxed"
              style={{ backgroundColor: 'var(--color-purple-dim)', borderColor: '#7c3aed30', color: 'var(--color-purple-light)' }}
            >
              {intro}
            </div>

            {children}
          </article>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-24">
      <h2
        className="text-xl font-bold"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        {children}
      </div>
    </section>
  );
}

export function Sub({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="flex flex-col gap-2 scroll-mt-24">
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{title}</p>
      {children}
    </div>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-purple)' }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm leading-relaxed"
      style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
    >
      {children}
    </div>
  );
}

export function Table({ head, rows }: { head: React.ReactNode[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ backgroundColor: 'var(--color-surface-2)' }}>
            {head.map((h, i) => (
              <th
                key={i}
                className="text-left font-semibold px-4 py-2.5 border-b whitespace-nowrap"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? '' : undefined} style={{ backgroundColor: ri % 2 === 1 ? 'var(--color-surface-2)' : undefined }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-4 py-2.5 border-b align-top"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
