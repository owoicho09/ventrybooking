import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { BlogCard } from '@/components/blog/BlogCard';
import { getAllPosts } from '@/sanity/lib/queries';

export const revalidate = 60;

const title = 'Blog — Ventry';
const description =
  'Guides, product updates and stories from the team building secure event ticketing for Nigeria.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/blog' },
  openGraph: {
    title,
    description,
    url: '/blog',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <div className="pt-16">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="mb-12 max-w-2xl">
            <h1
              className="text-4xl font-bold mb-3"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
            >
              The Ventry Blog
            </h1>
            <p style={{ color: 'var(--color-text-muted)' }}>{description}</p>
          </div>

          {posts.length === 0 ? (
            <div
              className="rounded-xl border p-12 text-center"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <p style={{ color: 'var(--color-text-muted)' }}>No posts published yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <BlogCard key={post._id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
