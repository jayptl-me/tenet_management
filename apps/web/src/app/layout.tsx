import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/themes/ThemeProvider';
import ServerWakeupOverlay from '@/components/shared/ServerWakeupOverlay';

export const metadata: Metadata = {
  title: {
    default: 'Tenet PG — Premium Paying Guest Accommodation',
    template: '%s | Tenet PG',
  },
  description:
    'Safe, comfortable, and well-managed paying guest accommodations with transparent billing, real-time updates, and zero hassle. Premium PG living for working professionals and students.',
  keywords: [
    'PG accommodation',
    'paying guest',
    'hostel',
    'co-living',
    'PG management',
    'Tenet PG',
  ],
  authors: [{ name: 'Tenet PG' }],
  creator: 'Tenet PG',
  metadataBase: new URL('https://tenetpg.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://tenetpg.com',
    siteName: 'Tenet PG',
    title: 'Tenet PG — Premium Paying Guest Accommodation',
    description:
      'Safe, comfortable, and well-managed paying guest accommodations with transparent billing and real-time updates.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Tenet PG — Premium PG Living',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tenet PG — Premium Paying Guest Accommodation',
    description:
      'Safe, comfortable, and well-managed paying guest accommodations with transparent billing and real-time updates.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <ServerWakeupOverlay />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
