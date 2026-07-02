'use client';

import { useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { newIdempotencyKey } from '@/lib/idempotency';
import { refreshWallet } from '@/lib/wallet';
import { TradeView } from '@/lib/types';
import { formatMoney } from './money';

interface Props {
  trade: TradeView;
  onUpdated: (trade: TradeView) => void;
}

const btn =
  'rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed';

/** Shown when this viewer has no buttons — explains who acts next. */
function waitHint(state: string, viewer: string): string | null {
  const key = `${state}:${viewer}`;
  const hints: Record<string, string> = {
    'DRAFT:SELLER': 'Submit this trade for authentication.',
    'DRAFT:BUYER': 'Waiting for the seller to submit for authentication.',
    'DRAFT:AUTHENTICATOR': 'Waiting for the seller to submit for authentication.',
    'PENDING_AUTH:AUTHENTICATOR': 'Record PASS, FAIL, or INCONCLUSIVE verdict.',
    'PENDING_AUTH:BUYER': 'Watch is with the authenticator.',
    'PENDING_AUTH:SELLER': 'Waiting for authenticator verdict.',
    'AUTH_PASSED:BUYER': 'Authentication passed — fund escrow before the deadline.',
    'AUTH_PASSED:SELLER': 'Waiting for the buyer to fund escrow (48h deadline).',
    'AUTH_PASSED:AUTHENTICATOR':
      'Verdict recorded. Log in as the buyer → My trades → Fund escrow.',
    'AUTH_PASSED:ADMIN': 'Waiting for the buyer to fund escrow.',
    'ESCROW_FUNDED:BUYER': 'Escrow funded — waiting for the seller to ship.',
    'ESCROW_FUNDED:SELLER': 'Mark the watch as shipped with a tracking number.',
    'ESCROW_FUNDED:AUTHENTICATOR': 'Waiting for the seller to ship.',
    'SHIPPED:BUYER': 'In transit — waiting for delivery confirmation.',
    'SHIPPED:SELLER': 'Waiting for admin to mark delivered (shipping webhook).',
    'SHIPPED:AUTHENTICATOR': 'Waiting for delivery confirmation.',
    'SHIPPED:ADMIN': 'Mark this trade as delivered (simulated shipping webhook).',
    'DELIVERED:BUYER': 'Release funds to the seller, or raise a dispute.',
    'DELIVERED:SELLER': 'Waiting for the buyer to release funds.',
    'DELIVERED:AUTHENTICATOR': 'Waiting for the buyer to release or dispute.',
    'DISPUTED:BUYER': 'You may still release funds if resolved.',
    'DISPUTED:SELLER': 'Dispute open — admin will resolve.',
    'DISPUTED:AUTHENTICATOR': 'Dispute open — admin will release or refund.',
  };
  return hints[key] ?? null;
}

export function StateActionPanel({ trade, onUpdated }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [reason, setReason] = useState('');
  const [verdict, setVerdict] = useState<'PASS' | 'FAIL' | 'INCONCLUSIVE'>('PASS');
  const [notes, setNotes] = useState('');

  // Stable key per fund attempt so a retry/double-click reuses it (idempotent).
  const fundKey = useRef<string | null>(null);

  async function run(
    action: string,
    path: string,
    opts: { body?: unknown; idempotencyKey?: string } = {},
  ) {
    setLoading(action);
    setError(null);
    try {
      const updated = await apiFetch<TradeView>(path, {
        method: 'POST',
        body: opts.body,
        idempotencyKey: opts.idempotencyKey,
      });
      // Fund endpoint returns a compact receipt; re-fetch full projection.
      if (action === 'FUND_ESCROW') {
        const full = await apiFetch<TradeView>(`/trades/${trade.tradeId}`);
        onUpdated(full);
        fundKey.current = null;
      } else {
        onUpdated(updated);
      }
      await refreshWallet();
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      if (action === 'FUND_ESCROW') {
        fundKey.current = null;
      }
    } finally {
      setLoading(null);
    }
  }

  const actions = trade.nextActions;
  const escrowDue = parseFloat(trade.grossAmount);
  const walletAvailable = trade.walletBalance ? parseFloat(trade.walletBalance) : 0;
  const canFundEscrow =
    trade.viewer !== 'BUYER' || !actions.includes('FUND_ESCROW') || walletAvailable >= escrowDue;

  if (actions.length === 0) {
    const hint = waitHint(trade.state, trade.viewer);
    return (
      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        <p>
          No actions for you in state <strong>{trade.state.replace(/_/g, ' ')}</strong>.
        </p>
        {hint && <p className="mt-2 text-ink">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {actions.includes('SUBMIT_FOR_AUTH') && (
        <button
          className={`${btn} bg-ink`}
          disabled={!!loading}
          onClick={() => run('SUBMIT_FOR_AUTH', `/trades/${trade.tradeId}/submit-for-auth`)}
        >
          {loading === 'SUBMIT_FOR_AUTH' ? 'Submitting…' : 'Submit for authentication'}
        </button>
      )}

      {actions.includes('RECORD_VERDICT') && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold">Record authentication verdict</p>
          <select
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as typeof verdict)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
            <option value="INCONCLUSIVE">INCONCLUSIVE</option>
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            className={`${btn} bg-amber-600`}
            disabled={!!loading}
            onClick={() =>
              run('RECORD_VERDICT', `/trades/${trade.tradeId}/authentication-verdict`, {
                body: { verdict, notes },
              })
            }
          >
            {loading === 'RECORD_VERDICT' ? 'Recording…' : 'Submit verdict'}
          </button>
        </div>
      )}

      {actions.includes('FUND_ESCROW') && (
        <div className="space-y-2">
          {!canFundEscrow ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Insufficient wallet balance. You need {formatMoney(trade.grossAmount)} to fund
              escrow (available: {formatMoney(trade.walletBalance ?? '0')}).
            </p>
          ) : null}
          <button
            className={`${btn} bg-blue-600`}
            disabled={!!loading || !canFundEscrow}
            onClick={() => {
              if (!fundKey.current) fundKey.current = newIdempotencyKey();
              run('FUND_ESCROW', `/trades/${trade.tradeId}/fund-escrow`, {
                body: {},
                idempotencyKey: fundKey.current,
              });
            }}
          >
            {loading === 'FUND_ESCROW' ? 'Funding…' : `Fund escrow (${formatMoney(trade.grossAmount)})`}
          </button>
        </div>
      )}

      {actions.includes('MARK_SHIPPED') && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold">Ship the watch</p>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Tracking number"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            className={`${btn} bg-indigo-600`}
            disabled={!!loading || tracking.trim().length < 3}
            onClick={() =>
              run('MARK_SHIPPED', `/trades/${trade.tradeId}/mark-shipped`, {
                body: { trackingNumber: tracking },
              })
            }
          >
            {loading === 'MARK_SHIPPED' ? 'Marking…' : 'Mark shipped'}
          </button>
        </div>
      )}

      {actions.includes('MARK_DELIVERED') && (
        <button
          className={`${btn} bg-teal-600`}
          disabled={!!loading}
          onClick={() => run('MARK_DELIVERED', `/trades/${trade.tradeId}/mark-delivered`)}
        >
          {loading === 'MARK_DELIVERED' ? 'Updating…' : 'Mark delivered (webhook)'}
        </button>
      )}

      {actions.includes('RELEASE') && (
        <button
          className={`${btn} bg-green-600`}
          disabled={!!loading}
          onClick={() => run('RELEASE', `/trades/${trade.tradeId}/release`)}
        >
          {loading === 'RELEASE' ? 'Releasing…' : 'Release funds'}
        </button>
      )}

      {actions.includes('DISPUTE') && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold">Raise a dispute</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for dispute"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            className={`${btn} bg-orange-600`}
            disabled={!!loading || reason.trim().length < 3}
            onClick={() =>
              run('DISPUTE', `/trades/${trade.tradeId}/dispute`, { body: { reason } })
            }
          >
            {loading === 'DISPUTE' ? 'Submitting…' : 'Raise dispute'}
          </button>
        </div>
      )}

      {actions.includes('REFUND') && (
        <button
          className={`${btn} bg-rose-600`}
          disabled={!!loading}
          onClick={() => run('REFUND', `/trades/${trade.tradeId}/refund`)}
        >
          {loading === 'REFUND' ? 'Refunding…' : 'Refund buyer'}
        </button>
      )}
    </div>
  );
}
