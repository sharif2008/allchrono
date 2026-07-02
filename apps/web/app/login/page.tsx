'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { saveSession, SessionUser } from '@/lib/auth';

const DEMO_USERS = [
  { email: 'buyer@example.com', label: 'Buyer' },
  { email: 'seller@example.com', label: 'Seller' },
  { email: 'authenticator@example.com', label: 'Authenticator' },
  { email: 'admin@example.com', label: 'Admin' },
];

function homeForUser(user: SessionUser): string {
  if (user.roles.includes('SELLER')) return '/seller/dashboard';
  if (user.roles.includes('ADMIN') || user.roles.includes('AUTHENTICATOR')) return '/admin/dashboard';
  if (user.roles.includes('BUYER')) return '/trades';
  return '/watches';
}

export default function LoginPage() {
  const [email, setEmail] = useState('buyer@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(withEmail: string, withPassword: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ accessToken: string; user: SessionUser }>('/auth/login', {
        method: 'POST',
        body: { email: withEmail, password: withPassword },
      });
      saveSession(res.accessToken, res.user);

      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      const destination =
        returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : homeForUser(res.user);

      // Full navigation so layout (nav, wallet) re-reads session from localStorage.
      window.location.assign(destination);
    } catch (e) {
      setError((e as ApiError).message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold">Log in</h1>
      <p className="mb-6 text-sm text-slate-500">
        Use a seeded account (all passwords are <code>password123</code>).
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(email, password);
        }}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-6"
      >
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <label className="block text-sm font-medium">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <label className="block text-sm font-medium">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-ink py-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Quick demo login</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              disabled={loading}
              onClick={() => submit(u.email, 'password123')}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
