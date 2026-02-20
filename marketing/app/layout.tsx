import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://brandmenow.com'),
  title: {
    default: 'Brand Me Now — AI-Powered Brand Creation for Creators',
    template: '%s | Brand Me Now',
  },
  description:
    'Go from social media presence to branded product line in minutes. AI-powered brand identity, logos, and product mockups in one guided session.',
  keywords: [
    'brand creation',
    'AI branding',
    'creator branding',
    'logo generator',
    'product mockups',
    'social media brand',
    'brand identity',
  ],
  authors: [{ name: 'Brand Me Now' }],
  creator: 'Brand Me Now',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://brandmenow.com',
    siteName: 'Brand Me Now',
    title: 'Brand Me Now — AI-Powered Brand Creation for Creators',
    description:
      'Go from social media presence to branded product line in minutes. AI-powered brand identity, logos, and product mockups.',
    images: [
      {
        url: '/og/default.png',
        width: 1200,
        height: 630,
        alt: 'Brand Me Now — AI-Powered Brand Creation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brand Me Now — AI-Powered Brand Creation for Creators',
    description:
      'Go from social media presence to branded product line in minutes.',
    images: ['/og/default.png'],
    creator: '@brandmenow',
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
}: {
  children: React.ReactNode;
}) {
  const jsonLdOrg = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Brand Me Now',
    url: 'https://brandmenow.com',
    logo: 'https://brandmenow.com/logo.png',
    sameAs: [
      'https://twitter.com/brandmenow',
      'https://instagram.com/brandmenow',
      'https://tiktok.com/@brandmenow',
    ],
  };

  const jsonLdApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Brand Me Now',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'AI-powered brand creation platform. Go from social media to branded product line in minutes.',
    url: 'https://brandmenow.com',
    offers: [
      { '@type': 'Offer', name: 'Free Trial', price: '0', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Starter', price: '29', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro', price: '79', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Agency', price: '199', priceCurrency: 'USD' },
    ],
  };

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }}
        />
      </head>
      <body className="min-h-screen bg-[var(--bmn-color-background)] text-[var(--bmn-color-text)] antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
