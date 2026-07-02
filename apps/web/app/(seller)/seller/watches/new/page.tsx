'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getToken, getUser, loginPath } from '@/lib/auth';

interface FormState {
  brand: string;
  model: string;
  referenceNumber: string;
  serialFingerprint: string;
  askingPrice: string;
  condition: string;
  listingPhotos: string;
}

const EMPTY: FormState = {
  brand: '',
  model: '',
  referenceNumber: '',
  serialFingerprint: '',
  askingPrice: '',
  condition: '',
  listingPhotos: '',
};

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [listed, setListed] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const user = getUser();
    if (!getToken() || !user?.roles.includes('SELLER')) router.push(loginPath());
  }, [router]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const step1Valid =
    form.brand.length >= 2 && form.model.length >= 1 && form.referenceNumber.length >= 1;
  const step2Valid =
    form.serialFingerprint.length >= 3 &&
    parseFloat(form.askingPrice) > 0 &&
    form.condition.length >= 2;

  async function submit() {
    setError(null);
    setSaveState('saved');
    try {
      await apiFetch('/watches', {
        method: 'POST',
        body: {
          brand: form.brand,
          model: form.model,
          referenceNumber: form.referenceNumber,
          serialFingerprint: form.serialFingerprint,
          askingPrice: parseFloat(form.askingPrice),
          condition: form.condition,
          listingPhotos: form.listingPhotos
            ? form.listingPhotos.split(',').map((s) => s.trim())
            : [],
          listed,
        },
      });
      router.push('/seller/dashboard');
    } catch (e) {
      setSaveState('idle');
      setError((e as ApiError).message);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">New listing</h1>
      <p className="mb-6 text-sm text-slate-500">Step {step} of 2</p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {saveState === 'saved' && (
        <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saving listing…
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        {step === 1 && (
          <>
            <Input label="Brand" value={form.brand} onChange={(v) => set('brand', v)} />
            <Input label="Model" value={form.model} onChange={(v) => set('model', v)} />
            <Input
              label="Reference number"
              value={form.referenceNumber}
              onChange={(v) => set('referenceNumber', v)}
            />
            <button
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="w-full rounded-md bg-ink py-2 font-semibold text-white disabled:opacity-50"
            >
              Next
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <Input
              label="Serial fingerprint"
              value={form.serialFingerprint}
              onChange={(v) => set('serialFingerprint', v)}
            />
            <Input
              label="Asking price (USD)"
              type="number"
              value={form.askingPrice}
              onChange={(v) => set('askingPrice', v)}
            />
            <Input
              label="Condition"
              value={form.condition}
              onChange={(v) => set('condition', v)}
            />
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
                Listed — visible to buyers on the marketplace
              </label>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="listed"
                  checked={!listed}
                  onChange={() => setListed(false)}
                />
                Unlisted — save inventory only, not visible to buyers yet
              </label>
            </fieldset>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-md border border-slate-300 py-2 font-semibold"
              >
                Back
              </button>
              <button
                disabled={!step2Valid || saveState === 'saved'}
                onClick={submit}
                className="flex-1 rounded-md bg-ink py-2 font-semibold text-white disabled:opacity-50"
              >
                Create listing
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
      />
    </div>
  );
}
