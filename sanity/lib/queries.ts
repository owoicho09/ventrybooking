import type { BlogPost } from '@/types';
import { client } from './client';

// Only posts with a slug and a publishedAt in the past are considered "published".
// Sanity's read client already excludes drafts, this filter additionally excludes
// scheduled/future-dated posts.
const publishedFilter = `_type == "post" && defined(slug.current) && defined(publishedAt) && publishedAt <= now()`;

const listProjection = `{
  _id,
  title,
  slug,
  mainImage,
  publishedAt,
  "author": author->{name, slug, image},
  "body": body[0...4]
}`;

const detailProjection = `{
  _id,
  title,
  slug,
  mainImage,
  publishedAt,
  body,
  "author": author->{name, slug, image, bio},
  "categories": categories[]->{title, slug}
}`;

export async function getAllPosts(): Promise<BlogPost[]> {
  return client.fetch(
    `*[${publishedFilter}] | order(publishedAt desc) ${listProjection}`
  );
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  return client.fetch(
    `*[${publishedFilter} && slug.current == $slug][0] ${detailProjection}`,
    { slug }
  );
}

export async function getAllPostSlugs(): Promise<string[]> {
  return client.fetch(`*[${publishedFilter}].slug.current`);
}
