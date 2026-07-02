import Link from 'next/link';
import { WatchCard as WatchCardType } from '@/lib/types';
import { formatMoney } from './money';

export function WatchCard({ watch }: { watch: WatchCardType }) {
  const photo = watch.listingPhotos?.[0];
  return (
    <Link
      href={`/watches/${watch.id}`}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={`${watch.brand} ${watch.model}`}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">No image</div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-xs uppercase tracking-wide text-brass">{watch.brand}</p>
        <h3 className="font-semibold text-ink">{watch.model}</h3>
        <p className="text-sm text-slate-500">Ref. {watch.referenceNumber}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-lg font-bold">{formatMoney(watch.askingPrice)}</span>
          <span className="text-xs font-medium text-slate-500">{watch.status}</span>
        </div>
      </div>
    </Link>
  );
}
