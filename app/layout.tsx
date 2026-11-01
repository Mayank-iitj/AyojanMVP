import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Aayojan Studio — Event Planning Engine',
  description:
    'A production-grade, versioned event-planning engine for weddings, birthdays, and community events with typed LLM operations, deterministic budget and backward-timeline validation, explainable Plan Health Score, what-if sliders, and role-based sharing.',
  openGraph: {
    title: 'Aayojan Studio — Event Planning Engine',
    description:
      'Maintain one verified, versioned Event object (budget, timeline, vendors, tasks, ideas) and re-solve it after every change with explainable diffs and hard invariants.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aayojan Studio — Event Planning Engine',
    description:
      'Verified event-planning engine for weddings, birthdays, and community events.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body suppressHydrationWarning className="min-h-screen bg-[#FBF7F0] text-[#14110F] selection:bg-[#E8A33D]/25">
        {children}
      </body>
    </html>
  );
}
