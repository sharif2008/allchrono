'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getUser, hasRole } from '@/lib/auth';
import { WatchStatus } from '@/lib/types';

function formatSellerName(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  UNLISTED: 'Unlisted',
  LISTED: 'Listed for sale',
  IN_TRADE: 'In an active trade',
  SOLD: 'Sold',
};

interface WatchDetailActionsProps {
  watchId: string;
  sellerId: string;
  sellerEmail: string;
  status: WatchStatus;
  activeTradeId?: string | null;
  available: boolean;
}

export function WatchStatusLabel({ status }: { status: WatchStatus }) {
  return <>{WATCH_STATUS_LABELS[status] ?? status}</>;
}

export function WatchDetailActions({
  watchId,
  sellerId,
  sellerEmail,
  status,
  activeTradeId,
  available,
}: WatchDetailActionsProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const user = getUser();
    setIsOwner(
      !!user &&
        hasRole(user, 'SELLER') &&
        (user.id === sellerId || user.email === sellerEmail),
    );
  }, [sellerId, sellerEmail]);

  const canEdit = (status === 'LISTED' || status === 'UNLISTED') && !activeTradeId;
  const isUnlisted = status === 'UNLISTED';

  async function setListed(listed: boolean) {
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/watches/${watchId}/${listed ? 'list' : 'unlist'}`, { method: 'POST' });
      router.refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) {
    return <div className="mt-6 h-12" aria-hidden />;
  }

  return (
    <div className="mt-6 space-y-3">
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!isOwner && available ? (
          <Link
            href={`/checkout/${watchId}`}
            className="inline-block rounded-md bg-ink px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            Buy this watch
          </Link>
        ) : null}

        {!isOwner && isUnlisted ? (
          <span className="inline-block rounded-md bg-amber-50 px-6 py-3 font-semibold text-amber-800">
            Unlisted
          </span>
        ) : null}

        {!isOwner && !available && !isUnlisted ? (
          <span className="inline-block rounded-md bg-slate-200 px-6 py-3 font-semibold text-slate-500">
            Not available
          </span>
        ) : null}

        {isOwner ? (
          <>
            {isUnlisted ? (
              <p className="w-full text-sm text-amber-800">
                This watch is unlisted. List it on the marketplace when you are ready for buyers.
              </p>
            ) : null}

            {activeTradeId ? (
              <Link
                href={`/seller/trades/${activeTradeId}`}
                className="inline-block rounded-md border border-brass bg-brass/10 px-6 py-3 font-semibold text-ink hover:bg-brass/20"
              >
                Manage as seller
              </Link>
            ) : (
              <>
                <Link
                  href="/seller/dashboard"
                  className="inline-block rounded-md border border-brass bg-brass/10 px-6 py-3 font-semibold text-ink hover:bg-brass/20"
                >
                  Manage as seller
                </Link>
                {canEdit ? (
                  <Link
                    href={`/seller/watches/${watchId}/edit`}
                    className="inline-block rounded-md border border-slate-300 px-6 py-3 font-semibold text-ink hover:bg-slate-50"
                  >
                    Edit listing
                  </Link>
                ) : null}
                {isUnlisted ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setListed(true)}
                    className="inline-block rounded-md bg-ink px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? 'Listing…' : 'List on marketplace'}
                  </button>
                ) : status === 'LISTED' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setListed(false)}
                    className="inline-block rounded-md border border-slate-300 px-6 py-3 font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busy ? 'Unlisting…' : 'Unlist'}
                  </button>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function SellerName({ email }: { email: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium">Seller:</dt>
      <dd>{formatSellerName(email)}</dd>
    </div>
  );
}
