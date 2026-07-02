'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getToken, getUser, loginPath } from '@/lib/auth';
import { refreshWallet } from '@/lib/wallet';
import { formatMoney } from '@/components/money';
import { TradeStatusBadge } from '@/components/trade-status-badge';
import { TradeState } from '@/lib/types';

interface BuyerTrade {
  tradeId: string;
  state: TradeState;
  watch: { brand: string; model: string; referenceNumber: string };
  grossAmount: string;
  escrowDueAt: string | null;
  nextActions: string[];
  createdAt: string;
}

const NEXT_STEP: Partial<Record<TradeState, string>> = {
  DRAFT: 'Waiting for seller to submit for authentication.',
  PENDING_AUTH: 'Watch is being authenticated.',
  AUTH_PASSED: 'Authentication passed — fund escrow before the deadline.',
  ESCROW_FUNDED: 'Escrow funded — waiting for seller to ship.',
  SHIPPED: 'Shipped — waiting for delivery confirmation.',
  DELIVERED: 'Delivered — release funds or raise a dispute.',
  DISPUTED: 'Dispute open — awaiting resolution.',
};

export default function BuyerTradesPage() {
  const router = useRouter();
  const [trades, setTrades] = useState<BuyerTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!getToken() || !user?.roles.includes('BUYER')) {
      router.push(loginPath());
      return;
    }
    apiFetch<BuyerTrade[]>('/trades/mine')
      .then(setTrades)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
    refreshWallet();
  }, [router]);

  const needsAction = trades.filter((t) => t.nextActions.length > 0);

  return (
    <div>
      <h1 className="text-3xl font-bold">My trades</h1>
      <p className="mb-6 text-sm text-slate-500">
        After authentication passes, open a trade here to <strong>Fund escrow</strong>.
      </p>

      {error && <p className="text-red-600">{error}</p>}

      {needsAction.length > 0 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 font-semibold text-blue-800">Action required ({needsAction.length})</h2>
          <ul className="space-y-1 text-sm">
            {needsAction.map((t) => (
              <li key={t.tradeId}>
                <Link href={`/trades/${t.tradeId}`} className="font-medium hover:underline">
                  {t.watch.brand} {t.watch.model} — {t.nextActions.join(', ').replace(/_/g, ' ')} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : trades.length === 0 ? (
        <p className="text-slate-500">
          No trades yet. Browse the{' '}
          <Link href="/watches" className="font-medium text-ink underline">
            marketplace
          </Link>{' '}
          to buy a watch.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Watch</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Next step</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.tradeId} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {t.watch.brand} {t.watch.model}
                    </div>
                    <div className="text-xs text-slate-400">Ref. {t.watch.referenceNumber}</div>
                  </td>
                  <td className="px-4 py-3">{formatMoney(t.grossAmount)}</td>
                  <td className="px-4 py-3">
                    <TradeStatusBadge state={t.state} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.nextActions.length > 0 ? (
                      <span className="font-medium text-blue-700">
                        {t.nextActions.join(', ').replace(/_/g, ' ')}
                      </span>
                    ) : (
                      NEXT_STEP[t.state] ?? '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/trades/${t.tradeId}`}
                      className="font-semibold text-ink hover:underline"
                    >
                      Open
                    </Link>
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
