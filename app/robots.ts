import type { MetadataRoute } from 'next';

// www, not the apex — the apex 307-redirects to www.
const baseUrl = 'https://www.ventrybooking.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/organizer', '/api', '/checkout', '/payment', '/ticket', '/scan', '/staff-scan', '/studio'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
