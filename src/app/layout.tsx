import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WorkPulse — Workforce Operations & HR Platform',
  description:
    'AI-Assisted Human Resource and Workforce Operations SaaS Platform for Educational Institutions and Enterprises',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className={`min-h-full flex flex-col bg-[#F4F5F7] text-[#181A1C] ${fontSans.className}`}
      >
        {children}
      </body>
    </html>
  );
}

