const API_BASE = import.meta.env.VITE_API_URL ?? '';

let sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// ---- Типы контрактов (переедут в @padelio/shared вместе с zod-схемами) ----

export interface ClubListItem {
  id: string;
  name: string;
  slug: string;
  district: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  courtsCount: number;
  priceFrom: number | null;
}

export interface ClubDetails extends ClubListItem {
  description: Record<string, string>;
  address: Record<string, string>;
  phone: string | null;
  telegramContact: string | null;
  cancellationPolicy: string;
  courts: Array<{ id: string; name: string; indoor: boolean; hasPanoramicGlass: boolean }>;
}

export interface SessionUser {
  id: string;
  firstName: string | null;
  language: 'uz' | 'ru' | 'en';
  phone: string | null;
  referralCode: string | null;
}
