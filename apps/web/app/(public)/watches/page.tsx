import type { Metadata } from 'next';
import Link from 'next/link';
import { serverGet } from '@/lib/api-client';
import { WatchCard } from '@/components/watch-card';
import { Catalogue } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Luxury Watch Marketplace',
  description:
    'Browse authenticated luxury watches. Every listing carries a verifiable ownership passport backed by escrow-secured trades.',
  alternates: { canonical: '/watches' },
  openGraph: {
    title: 'AllChrono — Luxury Watch Marketplace',
    description: 'Authenticated luxury watches with verifiable ownership passports.',
    type: 'website',
  },
};

interface PageProps {
  searchParams: { page?: string; status?: string };
}

export default async function WatchesPage({ searchParams }: PageProps) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const status = searchParams.status;
  const query = new URLSearchParams({ page: String(page), pageSize: '12' });
  if (status) query.set('status', status);

  const catalogue = await serverGet<Catalogue>(`/watches?${query.toString()}`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: catalogue.items.map((w, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * catalogue.pageSize + i + 1,
      item: {
        '@type': 'Product',
        name: `${w.brand} ${w.model}`,
        sku: w.referenceNumber,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: w.askingPrice,
          availability:
            w.status === 'LISTED'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
        },
      },
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-sm text-slate-500">
            {catalogue.total} watches · authenticated &amp; passport-verified
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <FilterLink label="All" active={!status} href="/watches" />
          <FilterLink label="Available" active={status === 'LISTED'} href="/watches?status=LISTED" />
          <FilterLink label="Sold" active={status === 'SOLD'} href="/watches?status=SOLD" />
        </div>
      </div>

      {catalogue.items.length === 0 ? (
        <p className="text-slate-500">No watches found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {catalogue.items.map((w) => (
            <WatchCard key={w.id} watch={w} />
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-4">
        <PageLink
          disabled={page <= 1}
          href={`/watches?${new URLSearchParams({
            ...(status ? { status } : {}),
            page: String(page - 1),
          })}`}
          label="Previous"
        />
        <span className="text-sm text-slate-500">
          Page {catalogue.page} of {catalogue.totalPages}
        </span>
        <PageLink
          disabled={page >= catalogue.totalPages}
          href={`/watches?${new URLSearchParams({
            ...(status ? { status } : {}),
            page: String(page + 1),
          })}`}
          label="Next"
        />
      </div>
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${
        active ? 'bg-ink text-white' : 'border border-slate-300 text-slate-600'
      }`}
    >
      {label}
    </Link>
  );
}

function PageLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
  if (disabled) {
    return <span className="cursor-not-allowed text-sm text-slate-300">{label}</span>;
  }
  return (
    <Link href={href} className="text-sm font-semibold text-ink hover:underline">
      {label}
    </Link>
  );
}
