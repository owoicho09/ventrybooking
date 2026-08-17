import { ImageResponse } from 'next/og';
import { SiteOGCard } from '@/lib/og/siteImage';

export const runtime = 'edge';
export const alt     = 'Ventry — Your Ticket to Every Experience';
export const size    = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(<SiteOGCard />, { ...size });
}
