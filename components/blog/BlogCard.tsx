import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { urlFor } from '@/sanity/lib/image';
import { getExcerpt } from '@/lib/blog';
import { formatShortDate } from '@/lib/utils';
import type { BlogPost } from '@/types';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  const coverUrl = post.mainImage?.asset
    ? urlFor(post.mainImage).width(640).height(360).fit('crop').auto('format').url()
    : null;
  const excerpt = getExcerpt(post.body);

  return (
    <Link
      href={`/blog/${post.slug.current}`}
      className="group rounded-xl border overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}
    >
      <div
        className="relative h-44 overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface-2)' }}
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={post.mainImage?.alt || post.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-3xl opacity-30 select-none"
            style={{ fontFamily: 'var(--font-syne), sans-serif', color: 'var(--color-purple)' }}
          >
            V
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-5 gap-3">
        <h3
          className="font-semibold text-lg leading-snug"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
        >
          {post.title}
        </h3>

        {excerpt && (
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--color-text-muted)' }}>
            {excerpt}
          </p>
        )}

        <div
          className="flex items-center justify-between mt-auto pt-3 border-t text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {post.author?.name && (
              <>
                <span className="truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {post.author.name}
                </span>
                <span>&middot;</span>
              </>
            )}
            <span className="whitespace-nowrap">{formatShortDate(post.publishedAt)}</span>
          </div>
          <ArrowRight
            size={14}
            className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
            style={{ color: 'var(--color-purple-light)' }}
          />
        </div>
      </div>
    </Link>
  );
}
