'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getToken, getUser, loginPath } from '@/lib/auth';
import { refreshWallet } from '@/lib/wallet';
import { TradeView, WatchDetail } from '@/lib/types';
import { formatMoney } from '@/components/money';

export default function CheckoutPage({ params }: { params: { watchId: string } }) {
  const router = useRouter();
  const [watch, setWatch] = useState<WatchDetail | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push(loginPath());
      return;
    }
    Promise.all([
      apiFetch<WatchDetail>(`/watches/${params.watchId}`),
      refreshWallet().catch(() => getUser()?.balance ?? null),
    ])
      .then(([w, balance]) => {
        setWatch(w);
        setWalletBalance(balance ?? getUser()?.balance ?? null);
      })
      .catch((e: ApiError) => setError(e.message));
  }, [params.watchId, router]);

  async function initiateTrade() {
    const user = getUser();
    if (!user?.roles.includes('BUYER')) {
      setError('You must be logged in as a buyer to purchase.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const trade = await apiFetch<TradeView>('/trades', {
        method: 'POST',
        body: { watchId: params.watchId },
      });
      router.push(`/trades/${trade.tradeId}`);
    } catch (e) {
      setError((e as ApiError).message);
      setSubmitting(false);
    }
  }

  if (error && !watch) return <p className="text-red-600">{error}</p>;
  if (!watch) return <p className="text-slate-500">Loading…</p>;

  const price = parseFloat(watch.askingPrice);
  const available = walletBalance ? parseFloat(walletBalance) : 0;
  const canFundLater = available >= price;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Start verified trade</h1>
      <p className="mt-1 text-sm text-slate-500">
        Starting a trade is free. After the watch passes authentication, you fund escrow from your
        wallet — that is when payment is deducted. The seller is paid only after you release funds
        on delivery.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm uppercase tracking-wide text-brass">{watch.brand}</p>
        <h2 className="text-xl font-semibold">{watch.model}</h2>
        <p className="text-sm text-slate-500">Ref. {watch.referenceNumber}</p>
        <p className="mt-4 text-2xl font-bold">{formatMoney(watch.askingPrice)}</p>

        {walletBalance !== null ? (
          <p className="mt-2 text-sm text-slate-600">
            Your wallet: <span className="font-semibold">{formatMoney(walletBalance)}</span>
            {!canFundLater ? (
              <span className="mt-1 block text-amber-800">
                You will need at least {formatMoney(watch.askingPrice)} to fund escrow after auth
                passes.
              </span>
            ) : null}
          </p>
        ) : null}

        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={initiateTrade}
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-ink py-3 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Starting trade…' : 'Start trade'}
        </button>
      </div>
    </div>
  );
}
