import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverGet, ApiError } from '@/lib/api-client';
import { PublicPassportSummary } from '@/components/passport-history';
import { formatMoney } from '@/components/money';
import { SellerName, WatchDetailActions, WatchStatusLabel } from '@/components/watch-seller-actions';
import { WatchDetail } from '@/lib/types';

async function fetchWatch(id: string): Promise<WatchDetail | null> {
  try {
    return await serverGet<WatchDetail>(`/watches/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const watch = await fetchWatch(params.id);
  if (!watch) return { title: 'Watch not found' };
  const title = `${watch.brand} ${watch.model} (Ref. ${watch.referenceNumber})`;
  const description = `${watch.brand} ${watch.model} — ${watch.condition}. ${formatMoney(
    watch.askingPrice,
  )}. Verified ownership passport included.`;
  return {
    title,
    description,
    alternates: { canonical: `/watches/${watch.id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      images: watch.listingPhotos?.length ? [watch.listingPhotos[0]] : undefined,
    },
  };
}

export default async function WatchDetailPage({ params }: { params: { id: string } }) {
  const watch = await fetchWatch(params.id);
  if (!watch) notFound();

  const available = watch.status === 'LISTED';

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div>
        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
          {watch.listingPhotos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={watch.listingPhotos[0]}
              alt={`${watch.brand} ${watch.model}`}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-sm uppercase tracking-wide text-brass">{watch.brand}</p>
        <h1 className="text-3xl font-bold tracking-tight">{watch.model}</h1>
        <p className="mt-1 text-slate-500">Reference {watch.referenceNumber}</p>
        <p className="mt-4 text-3xl font-bold">{formatMoney(watch.askingPrice)}</p>

        <dl className="mt-4 space-y-1 text-sm text-slate-600">
          <SellerName email={watch.sellerEmail} />
          <div className="flex gap-2">
            <dt className="font-medium">Condition:</dt>
            <dd>{watch.condition}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Serial:</dt>
            <dd className="font-mono">{watch.serialFingerprint}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Status:</dt>
            <dd>
              <WatchStatusLabel status={watch.status} />
            </dd>
          </div>
        </dl>

        <WatchDetailActions
          watchId={watch.id}
          sellerId={watch.sellerId}
          sellerEmail={watch.sellerEmail}
          status={watch.status}
          activeTradeId={watch.activeTradeId}
          available={available}
        />
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Ownership passport</h2>
          <PublicPassportSummary passport={watch.passport} />
        </section>
      </div>
    </div>
  );
}
