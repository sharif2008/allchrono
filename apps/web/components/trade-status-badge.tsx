import { TradeState } from '@/lib/types';

const STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_AUTH: 'bg-amber-100 text-amber-800',
  AUTH_PASSED: 'bg-emerald-100 text-emerald-800',
  AUTH_FAILED: 'bg-red-100 text-red-800',
  ESCROW_FUNDED: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-teal-100 text-teal-800',
  DISPUTED: 'bg-orange-100 text-orange-800',
  RELEASED: 'bg-green-100 text-green-800',
  REFUNDED_PRE_SHIP: 'bg-rose-100 text-rose-800',
  REFUNDED_POST_DELIVERY: 'bg-rose-100 text-rose-800',
  EXPIRED: 'bg-zinc-200 text-zinc-700',
  CANCELLED: 'bg-zinc-200 text-zinc-700',
  LOST_IN_TRANSIT: 'bg-red-100 text-red-800',
};

export function TradeStatusBadge({ state }: { state: TradeState | string }) {
  const cls = STYLES[state] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {String(state).replace(/_/g, ' ')}
    </span>
  );
}
