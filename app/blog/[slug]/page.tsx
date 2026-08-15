import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, ArrowLeft } from 'lucide-react';
import { PortableText } from '@portabletext/react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { portableTextComponents } from '@/components/blog/PortableTextComponents';
import { getAllPostSlugs, getPostBySlug } from '@/sanity/lib/queries';
import { urlFor } from '@/sanity/lib/image';
import { getExcerpt, estimateReadTime } from '@/lib/blog';
import { formatDate } from '@/lib/utils';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const description = getExcerpt(post.body, 160);
  const ogImage = post.mainImage?.asset
    ? urlFor(post.mainImage).width(1200).height(630).fit('crop').auto('format').url()
    : '/opengraph-image';

  return {
    title: `${post.title} — Ventry Blog`,
    description,
    alternates: { canonical: `/blog/${post.slug.current}` },
    openGraph: {
      title: post.title,
      description,
      url: `/blog/${post.slug.current}`,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: post.author?.name ? [post.author.name] : undefined,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  const coverUrl = post.mainImage?.asset
    ? urlFor(post.mainImage).width(1600).height(900).fit('crop').auto('format').url()
    : null;
  const readMinutes = estimateReadTime(post.body);

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <article className="pt-16">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm mb-8 hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft size={14} />
            Back to Blog
          </Link>

          <h1
            className="text-3xl sm:text-4xl font-bold mb-4 leading-tight"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
          >
            {post.title}
          </h1>

          <div
            className="flex items-center gap-3 text-sm mb-8 pb-8 border-b"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            {post.author?.name && (
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: 'var(--color-purple)' }}
                >
                  {post.author.image?.asset ? (
                    <Image
                      src={urlFor(post.author.image).width(64).height(64).fit('crop').auto('format').url()}
                      alt={post.author.name}
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  ) : (
                    post.author.name[0]
                  )}
                </div>
                <span style={{ color: 'var(--color-text)' }}>{post.author.name}</span>
              </div>
            )}
            {post.author?.name && <span>&middot;</span>}
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {readMinutes} min read
            </span>
          </div>

          {coverUrl && (
            <div
              className="relative w-full rounded-xl overflow-hidden mb-10"
              style={{ aspectRatio: '16 / 9', backgroundColor: 'var(--color-surface-2)' }}
            >
              <Image
                src={coverUrl}
                alt={post.mainImage?.alt || post.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
          )}

          <div>
            {post.body && <PortableText value={post.body} components={portableTextComponents} />}
          </div>
        </div>
      </article>
      <Footer />
    </div>
  );
}
