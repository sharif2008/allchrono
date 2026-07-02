'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getToken, getUser, loginPath } from '@/lib/auth';
import { refreshWallet } from '@/lib/wallet';
import { WatchCard } from '@/lib/types';
import { formatMoney } from '@/components/money';
import { TradeStatusBadge } from '@/components/trade-status-badge';

export default function SellerDashboard() {
  const router = useRouter();
  const [watches, setWatches] = useState<WatchCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!getToken() || !user?.roles.includes('SELLER')) {
      router.push(loginPath());
      return;
    }
    apiFetch<WatchCard[]>('/watches/mine')
      .then(setWatches)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
    refreshWallet();
  }, [router]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seller dashboard</h1>
          <p className="text-sm text-slate-500">Your inventory and active trades</p>
        </div>
        <Link
          href="/seller/watches/new"
          className="rounded-md bg-ink px-4 py-2 font-semibold text-white"
        >
          + New listing
        </Link>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : watches.length === 0 ? (
        <p className="text-slate-500">You have no listings yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Watch</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Active trade</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {watches.map((w) => (
                <tr key={w.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {w.brand} {w.model}
                    </div>
                    <div className="text-xs text-slate-400">Ref. {w.referenceNumber}</div>
                  </td>
                  <td className="px-4 py-3">{formatMoney(w.askingPrice)}</td>
                  <td className="px-4 py-3">{w.status}</td>
                  <td className="px-4 py-3">
                    {w.activeTradeState ? <TradeStatusBadge state={w.activeTradeState} /> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {w.activeTradeId ? (
                        <Link
                          href={`/seller/trades/${w.activeTradeId}`}
                          className="font-semibold text-ink hover:underline"
                        >
                          Manage
                        </Link>
                      ) : null}
                      {(w.status === 'LISTED' || w.status === 'UNLISTED') && !w.activeTradeId ? (
                        <Link
                          href={`/seller/watches/${w.id}/edit`}
                          className="font-semibold text-ink hover:underline"
                        >
                          Edit
                        </Link>
                      ) : null}
                      <Link href={`/watches/${w.id}`} className="text-slate-500 hover:underline">
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
