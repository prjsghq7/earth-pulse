import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Earth Pulse — 지구 맥박',
  description: 'KST 기준으로 기록하는 전 세계 규모 4.0 이상 지진 정보판',
  icons: {
    icon: [{ url: '/earth-pulse/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/earth-pulse/favicon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
