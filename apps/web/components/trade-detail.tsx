'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getToken, loginPath } from '@/lib/auth';
import { TradeView } from '@/lib/types';
import { TradeStatusBadge } from './trade-status-badge';
import { StateActionPanel } from './state-action-panel';
import { PassportHistory } from './passport-history';
import { formatMoney } from './money';

function countdown(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

export function TradeDetail({ tradeId }: { tradeId: string }) {
  const router = useRouter();
  const [trade, setTrade] = useState<TradeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push(loginPath());
      return;
    }
    apiFetch<TradeView>(`/trades/${tradeId}`)
      .then(setTrade)
      .catch((e: ApiError) => {
        if (e.status === 401) router.push(loginPath());
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [tradeId, router]);

  if (loading) return <p className="text-slate-500">Loading trade…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!trade) return null;

  const isBuyer = trade.viewer === 'BUYER';
  const isSeller = trade.viewer === 'SELLER';

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-brass">{trade.watch.brand}</p>
            <h1 className="text-2xl font-bold">{trade.watch.model}</h1>
            <p className="text-sm text-slate-500">Ref. {trade.watch.referenceNumber}</p>
          </div>
          <TradeStatusBadge state={trade.state} />
        </div>

        {/* Role-specific money view. Buyer never sees commission/net; seller
            never sees the buyer's funded instrument details. */}
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <Field label="Gross amount" value={formatMoney(trade.grossAmount)} />
          {(isBuyer || isSeller) && trade.walletBalance && (
            <Field label="Your wallet" value={formatMoney(trade.walletBalance)} />
          )}
          {isBuyer && (
            <>
              <Field
                label="Funded"
                value={trade.fundedAmount ? formatMoney(trade.fundedAmount) : 'Not funded'}
              />
              {trade.escrowDueAt && trade.state === 'AUTH_PASSED' && (
                <Field label="Fund before" value={countdown(trade.escrowDueAt) ?? '—'} />
              )}
              {trade.disputeDeadline && trade.state === 'DELIVERED' && (
                <Field label="Dispute window" value={countdown(trade.disputeDeadline) ?? '—'} />
              )}
            </>
          )}
          {isSeller && (
            <>
              <Field label="Commission (7%)" value={formatMoney(trade.commissionAmount)} />
              <Field label="Your net payout" value={formatMoney(trade.sellerNetAmount)} />
              {trade.shipmentSla && (
                <Field label="Ship before (SLA)" value={countdown(trade.shipmentSla) ?? '—'} />
              )}
              {trade.authFailedReason && (
                <Field label="Auth failed reason" value={trade.authFailedReason} />
              )}
            </>
          )}
          {trade.viewer === 'ADMIN' && (
            <>
              <Field label="Commission" value={formatMoney(trade.commissionAmount)} />
              <Field label="Seller net" value={formatMoney(trade.sellerNetAmount)} />
              <Field label="Funded" value={trade.fundedAmount ? formatMoney(trade.fundedAmount) : '—'} />
            </>
          )}
          {trade.trackingNumber && (
            <Field label="Tracking" value={trade.trackingNumber} />
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Trade pipeline &amp; passport</h2>
          <PassportHistory
            passport={trade.passportHistory}
            tradeState={trade.state}
            showPipeline={isBuyer || isSeller}
            showLedger={isBuyer || isSeller}
          />
          {!isBuyer && !isSeller ? (
            <p className="mt-3 text-sm text-slate-500">
              Pipeline and ledger details are limited to the buyer and seller on this trade.
            </p>
          ) : null}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Actions</h2>
          <StateActionPanel trade={trade} onUpdated={setTrade} />
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
