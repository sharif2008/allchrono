'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getToken, getUser, loginPath } from '@/lib/auth';
import { WatchDetail } from '@/lib/types';

interface FormState {
  brand: string;
  model: string;
  referenceNumber: string;
  serialFingerprint: string;
  askingPrice: string;
  condition: string;
  listingPhotos: string;
}

export default function EditListingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listed, setListed] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!getToken() || !user?.roles.includes('SELLER')) {
      router.push(loginPath());
      return;
    }

    apiFetch<WatchDetail>(`/watches/${params.id}`)
      .then((watch) => {
        if (watch.sellerId !== user.id && watch.sellerEmail !== user.email) {
          router.push('/seller/dashboard');
          return;
        }
        if (watch.activeTradeId || (watch.status !== 'LISTED' && watch.status !== 'UNLISTED')) {
          setError('This listing cannot be edited while a trade is in progress or after it is sold.');
        }
        setListed(watch.status === 'LISTED');
        setForm({
          brand: watch.brand,
          model: watch.model,
          referenceNumber: watch.referenceNumber,
          serialFingerprint: watch.serialFingerprint,
          askingPrice: watch.askingPrice,
          condition: watch.condition,
          listingPhotos: watch.listingPhotos?.join(', ') ?? '',
        });
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function submit() {
    if (!form) return;
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/watches/${params.id}`, {
        method: 'PATCH',
        body: {
          brand: form.brand,
          model: form.model,
          referenceNumber: form.referenceNumber,
          askingPrice: parseFloat(form.askingPrice),
          condition: form.condition,
          listingPhotos: form.listingPhotos
            ? form.listingPhotos.split(',').map((s) => s.trim())
            : [],
          listed,
        },
      });
      router.push(`/watches/${params.id}`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return <p className="text-slate-500">{loading ? 'Loading…' : 'Listing not found.'}</p>;
  }

  const editable =
    !error?.includes('cannot be edited') &&
    form.brand.length >= 2 &&
    form.model.length >= 1 &&
    form.referenceNumber.length >= 1 &&
    parseFloat(form.askingPrice) > 0 &&
    form.condition.length >= 2;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit listing</h1>
          <p className="text-sm text-slate-500">{form.brand} {form.model}</p>
        </div>
        <Link href={`/watches/${params.id}`} className="text-sm text-slate-500 hover:underline">
          View listing
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <Input label="Brand" value={form.brand} onChange={(v) => set('brand', v)} />
        <Input label="Model" value={form.model} onChange={(v) => set('model', v)} />
        <Input
          label="Reference number"
          value={form.referenceNumber}
          onChange={(v) => set('referenceNumber', v)}
        />
        <Input
          label="Serial fingerprint"
          value={form.serialFingerprint}
          onChange={() => undefined}
          disabled
          hint="Serial cannot be changed after the passport is created."
        />
        <Input
          label="Asking price (USD)"
          type="number"
          value={form.askingPrice}
          onChange={(v) => set('askingPrice', v)}
        />
        <Input label="Condition" value={form.condition} onChange={(v) => set('condition', v)} />
        <Input
          label="Photo URLs (comma separated)"
          value={form.listingPhotos}
          onChange={(v) => set('listingPhotos', v)}
        />
        <fieldset className="rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Marketplace visibility</legend>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="listed"
              checked={listed}
              onChange={() => setListed(true)}
            />
            Listed — visible to buyers
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="listed"
              checked={!listed}
              onChange={() => setListed(false)}
            />
            Unlisted — hidden from marketplace
          </label>
        </fieldset>
        <div className="flex gap-2 pt-2">
          <Link
            href={`/watches/${params.id}`}
            className="flex-1 rounded-md border border-slate-300 py-2 text-center font-semibold"
          >
            Cancel
          </Link>
          <button
            disabled={!editable || saving}
            onClick={submit}
            className="flex-1 rounded-md bg-ink py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
      />
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
