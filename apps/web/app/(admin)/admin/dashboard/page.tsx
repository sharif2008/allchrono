'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getToken, getUser, loginPath } from '@/lib/auth';
import { formatMoney } from '@/components/money';
import { TradeStatusBadge } from '@/components/trade-status-badge';
import { TradeState } from '@/lib/types';

interface OpsTrade {
  tradeId: string;
  state: TradeState;
  watch: { brand: string; model: string; referenceNumber: string };
  grossAmount: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [trades, setTrades] = useState<OpsTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticatorOnly, setIsAuthenticatorOnly] = useState(false);

  useEffect(() => {
    const user = getUser();
    const ok = getToken() && (user?.roles.includes('ADMIN') || user?.roles.includes('AUTHENTICATOR'));
    if (!ok) {
      router.push(loginPath());
      return;
    }
    setIsAuthenticatorOnly(!user?.roles.includes('ADMIN'));
    apiFetch<OpsTrade[]>('/trades')
      .then(setTrades)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const pendingAuth = trades.filter((t) => t.state === 'PENDING_AUTH');

  return (
    <div>
      <h1 className="text-3xl font-bold">
        {isAuthenticatorOnly ? 'Authenticator queue' : 'Admin operations'}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {isAuthenticatorOnly
          ? 'Trades awaiting your verdict'
          : 'All trades in the pipeline — act as the shipping webhook, release, or refund.'}
      </p>

      {error && <p className="text-red-600">{error}</p>}

      {pendingAuth.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 font-semibold text-amber-800">
            Awaiting authentication ({pendingAuth.length})
          </h2>
          <ul className="space-y-1 text-sm">
            {pendingAuth.map((t) => (
              <li key={t.tradeId}>
                <Link href={`/admin/trades/${t.tradeId}`} className="font-medium hover:underline">
                  {t.watch.brand} {t.watch.model} — record verdict →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Watch</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Created</th>
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
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/trades/${t.tradeId}`}
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
