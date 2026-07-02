import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/nav';

export const metadata: Metadata = {
  title: {
    default: 'AllChrono — The Verified Trade Pipeline',
    template: '%s · AllChrono',
  },
  description:
    'A trusted marketplace for luxury watches with escrow-backed trades and a verifiable ownership passport.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          <p>© {new Date().getFullYear()} AllChrono Inc. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
