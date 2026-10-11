'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  /** Candidate URLs, best first (see eventImages()). */
  sources: string[];
  sizes: string;
  priority?: boolean;
  alt?: string;
  style?: React.CSSProperties;
}

/**
 * A fill image that never leaves its slot blank while any real picture
 * exists: if the optimised version fails it retries the original file, and
 * if that fails too it moves on to the next candidate (flyer → header
 * banner → organiser cover → avatar).
 */
export function EventImage({ sources, sizes, priority = false, alt = '', style }: Props) {
  const [index, setIndex] = useState(0);
  const [raw, setRaw] = useState(false);
  const src = sources[index];
  if (!src) return null;

  const onError = () => {
    if (!raw) setRaw(true);
    else { setIndex(i => i + 1); setRaw(false); }
  };

  return (
    <Image
      key={`${src}|${raw}`}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={raw}
      onError={onError}
      style={style}
    />
  );
}
