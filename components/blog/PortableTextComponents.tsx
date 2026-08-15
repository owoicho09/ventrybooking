import Image from 'next/image';
import type { PortableTextComponents } from '@portabletext/react';
import { urlFor } from '@/sanity/lib/image';

export const portableTextComponents: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="text-base leading-relaxed mb-5" style={{ color: 'var(--color-text-muted)' }}>
        {children}
      </p>
    ),
    // Body headings start at h2 so the post title remains the page's single h1.
    h1: ({ children }) => (
      <h2
        className="text-2xl font-bold mt-10 mb-4"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
      >
        {children}
      </h2>
    ),
    h2: ({ children }) => (
      <h3
        className="text-xl font-bold mt-8 mb-3"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
      >
        {children}
      </h3>
    ),
    h3: ({ children }) => (
      <h4
        className="text-lg font-semibold mt-6 mb-3"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
      >
        {children}
      </h4>
    ),
    h4: ({ children }) => (
      <h5 className="text-base font-semibold mt-6 mb-2" style={{ color: 'var(--color-text)' }}>
        {children}
      </h5>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className="pl-4 my-6 italic text-base leading-relaxed border-l-2"
        style={{ borderColor: 'var(--color-purple)', color: 'var(--color-text)' }}
      >
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc pl-5 mb-5 space-y-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {children}
      </ul>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="leading-relaxed">{children}</li>,
  },
  marks: {
    strong: ({ children }) => (
      <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{children}</strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    link: ({ value, children }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:opacity-80"
        style={{ color: 'var(--color-purple-light)' }}
      >
        {children}
      </a>
    ),
  },
  types: {
    image: ({ value }) => {
      if (!value?.asset) return null;
      const imageUrl = urlFor(value).width(1200).auto('format').url();
      return (
        <span className="block my-8">
          <span
            className="relative block w-full rounded-xl overflow-hidden"
            style={{ aspectRatio: '16 / 9', backgroundColor: 'var(--color-surface-2)' }}
          >
            <Image
              src={imageUrl}
              alt={value.alt || ''}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 720px"
            />
          </span>
          {value.alt && (
            <span className="block text-center text-xs mt-2" style={{ color: 'var(--color-text-dim)' }}>
              {value.alt}
            </span>
          )}
        </span>
      );
    },
  },
};
