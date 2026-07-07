import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/themes/ThemeProvider';
import ServerWakeupOverlay from '@/components/shared/ServerWakeupOverlay';
import AppProviders from '@/components/shared/AppProviders';

export const metadata: Metadata = {
  title: {
    default: 'Apex PG — Premium Paying Guest Accommodation',
    template: '%s | Apex PG',
  },
  description:
    'Safe, comfortable, and well-managed paying guest accommodations with transparent billing, real-time updates, and zero hassle. Premium PG living for working professionals and students.',
  keywords: [
    'PG accommodation',
    'paying guest',
    'hostel',
    'co-living',
    'PG management',
    'Apex PG',
  ],
  authors: [{ name: 'Apex PG' }],
  creator: 'Apex PG',
  metadataBase: new URL('https://apexpg.com'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://apexpg.com',
    siteName: 'Apex PG',
    title: 'Apex PG — Premium Paying Guest Accommodation',
    description:
      'Safe, comfortable, and well-managed paying guest accommodations with transparent billing and real-time updates.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Apex PG — Premium PG Living',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apex PG — Premium Paying Guest Accommodation',
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
    <html lang="en" className="h-full antialiased" data-theme="saas" data-mode="light" suppressHydrationWarning>
      <head />
      <body className="flex min-h-full flex-col">
        <AppProviders>
          <ThemeProvider>
            <ServerWakeupOverlay />
            {children}
          </ThemeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
