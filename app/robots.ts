import type { MetadataRoute } from 'next';

const baseUrl = 'https://ventrybooking.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/organizer', '/api', '/checkout', '/payment', '/ticket', '/scan', '/staff-scan'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
