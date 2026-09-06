import { ImageResponse } from 'next/og';
import { SiteOGCard, getLogoDataUri } from '@/lib/og/siteImage';

export const runtime = 'edge';
export const alt     = 'Ventry — Your Ticket to Every Experience';
export const size    = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  const logoSrc = await getLogoDataUri();
  return new ImageResponse(<SiteOGCard logoSrc={logoSrc} />, { ...size });
}
