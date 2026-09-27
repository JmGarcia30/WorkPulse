import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkPulse — Workforce Operations & HR Platform',
  description:
    'AI-Assisted Human Resource and Workforce Operations SaaS Platform for Educational Institutions and Enterprises',
  icons: {
    icon: [
      { url: '/favicon.ico?v=wmark-1', sizes: 'any' },
      { url: '/branding/workpulse-app-icon.png?v=wmark-1', type: 'image/png' },
      { url: '/icon.png?v=wmark-1', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=wmark-1',
    apple: '/branding/workpulse-app-icon.png?v=wmark-1',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
