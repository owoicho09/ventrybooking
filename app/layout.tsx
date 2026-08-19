import type { Metadata } from 'next';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  // www, not the bare apex — the apex 307-redirects to www, and link-preview
  // crawlers (WhatsApp, etc.) generally don't follow redirects when fetching
  // og:image, so an apex-based metadataBase silently breaks every share
  // preview's image in favor of a generic fallback.
  metadataBase: new URL('https://www.ventrybooking.com'),

  title: 'Ventry — Your Ticket to Every Experience',
  description:
    'Discover and buy tickets to the best parties, concerts and events across Nigeria. Every payment protected in escrow.',

  openGraph: {
    title: 'Ventry — Your Ticket to Every Experience',
    description:
      'Discover and buy tickets to the best parties, concerts and events across Nigeria. Every payment protected in escrow.',
    siteName: 'Ventry',
    url: 'https://ventrybooking.com',
    type: 'website',
    locale: 'en_NG',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Ventry — Your Ticket to Every Experience',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Ventry — Your Ticket to Every Experience',
    description:
      'Discover and buy tickets to the best parties, concerts and events across Nigeria. Every payment protected in escrow.',
    images: ['/opengraph-image'],
  },

  icons: {
    icon:  '/icon',
    apple: '/icon',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
