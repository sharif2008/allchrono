import { apiFetch } from './api-client';
import { getToken, getUser, saveSession } from './auth';

/** Fetch latest wallet balance from API and update the stored session. */
export async function refreshWallet(): Promise<string | null> {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return null;

  try {
    const profile = await apiFetch<{ balance: string }>('/auth/me');
    saveSession(token, { ...user, balance: profile.balance });
    window.dispatchEvent(
      new CustomEvent('allchrono:wallet-updated', { detail: profile.balance }),
    );
    return profile.balance;
  } catch {
    return null;
  }
}
