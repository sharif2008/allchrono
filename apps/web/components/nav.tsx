'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getUser, SessionUser } from '@/lib/auth';
import { WalletBadge } from '@/components/wallet-badge';

export function Nav() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(getUser());
  }, []);

  function logout() {
    clearSession();
    setUser(null);
    router.push('/login');
  }

  const roles = user?.roles ?? [];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/watches" className="text-lg font-bold tracking-tight text-ink">
          All<span className="text-brass">Chrono</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/watches" className="hover:text-ink">
            Marketplace
          </Link>
          {roles.includes('BUYER') && (
            <Link href="/trades" className="hover:text-ink">
              My trades
            </Link>
          )}
          {roles.includes('SELLER') && (
            <Link href="/seller/dashboard" className="hover:text-ink">
              Seller
            </Link>
          )}
          {roles.includes('ADMIN') && (
            <Link href="/admin/dashboard" className="hover:text-ink">
              Admin
            </Link>
          )}
          {roles.includes('AUTHENTICATOR') && (
            <Link href="/admin/dashboard" className="hover:text-ink">
              Authenticator
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <WalletBadge />
              <span className="text-slate-500">{user.email}</span>
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-ink px-3 py-1 text-white hover:opacity-90"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
