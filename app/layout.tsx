// app/layout.tsx  (SERVER component - "use client" YOK)
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientShell from './client-shell'; // birazdan oluşturacağız

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MatchFinder',
  description: 'MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
