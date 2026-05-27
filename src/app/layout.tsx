import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'We Buy Clean Trash — Turning recyclables into rewards.',
    template: '%s · We Buy Clean Trash',
  },
  description:
    'Separate your clean cans, bottles, and cardboard into pickup bags. Leave them door side and earn rewards with every pickup. Built by operators with 40+ years in recycling.',
  openGraph: {
    title: 'We Buy Clean Trash',
    description: 'Turn your clean recyclables into rewards. Curbside pickup, no sorting fees.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
