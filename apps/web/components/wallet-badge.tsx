'use client';

import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import { formatMoney } from './money';
import { refreshWallet } from '@/lib/wallet';

/** Simulated wallet balance for buyer/seller accounts. */
export function WalletBadge() {
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!user?.roles.some((r) => r === 'BUYER' || r === 'SELLER')) return;

    setBalance(user.balance ?? null);
    refreshWallet().then((b) => {
      if (b) setBalance(b);
    });

    const onUpdate = (e: Event) => {
      setBalance((e as CustomEvent<string>).detail);
    };
    window.addEventListener('allchrono:wallet-updated', onUpdate);
    return () => window.removeEventListener('allchrono:wallet-updated', onUpdate);
  }, []);

  if (balance === null) return null;

  return (
    <span
      className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
      title="Simulated wallet balance"
    >
      Wallet {formatMoney(balance)}
    </span>
  );
}
