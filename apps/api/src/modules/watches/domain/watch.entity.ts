import { WatchStatus } from '@prisma/client';

/**
 * Watch listing rules. Kept intentionally light — the trade lifecycle, not the
 * watch, is the transactional aggregate. A watch flips to IN_TRADE while a
 * non-terminal trade exists and to SOLD once released.
 */
export const NON_TERMINAL_WATCH_STATUSES: WatchStatus[] = [
  WatchStatus.IN_TRADE,
];

export function canListWatch(status: WatchStatus): boolean {
  return status === WatchStatus.UNLISTED || status === WatchStatus.LISTED;
}

export function canEditWatch(status: WatchStatus, hasActiveTrade: boolean): boolean {
  return canListWatch(status) && !hasActiveTrade;
}
