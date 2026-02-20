import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the Brand Me Now team. Questions, support, partnerships, and press inquiries.',
  openGraph: {
    title: 'Contact | Brand Me Now',
    description:
      'Get in touch with the Brand Me Now team.',
    url: 'https://brandmenow.com/contact',
    images: [{ url: '/og/default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact | Brand Me Now',
    description: 'Get in touch with the Brand Me Now team.',
    images: ['/og/default.png'],
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
