export type Role = 'BUYER' | 'SELLER' | 'AUTHENTICATOR' | 'ADMIN';

export interface SessionUser {
  id: string;
  email: string;
  roles: Role[];
  kycStatus?: string;
  balance?: string;
}

const TOKEN_KEY = 'allchrono.token';
const USER_KEY = 'allchrono.user';

export function saveSession(token: string, user: SessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function hasRole(user: SessionUser | null, role: Role): boolean {
  return !!user?.roles.includes(role);
}

/** Login URL; optional returnTo sends the user back after sign-in. */
export function loginPath(returnTo?: string): string {
  let target = returnTo;
  if (target === undefined && typeof window !== 'undefined') {
    target = window.location.pathname + window.location.search;
  }
  if (!target || target.startsWith('/login')) return '/login';
  return `/login?returnTo=${encodeURIComponent(target)}`;
}
