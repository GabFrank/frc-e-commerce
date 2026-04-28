import { headers } from 'next/headers';

const SHOP_API_URL = process.env.SHOP_API_URL ?? 'http://localhost:3000/shop-api';

export interface VendureRequestOptions {
  query: string;
  variables?: Record<string, unknown>;
  channelToken?: string;
}

/**
 * Cliente GraphQL minimal para Vendure Shop API.
 * Usa fetch nativo de Next 16 (Server Components).
 *
 * El channelToken se resuelve desde:
 *   1. Argumento explícito (override)
 *   2. Header `x-frc-subdomain` seteado por middleware → mapeo a token
 *   3. ENV var DEFAULT_CHANNEL_TOKEN como fallback
 *
 * En MVP el mapeo subdomain → channelToken se hace contra el plugin
 * tenant-management (query `tenantBySubdomain`). Para no bloquear scaffold,
 * por ahora solo pasa el subdomain como token directamente — esto se
 * reemplaza cuando el plugin está implementado.
 */
export async function vendureRequest<T>({
  query,
  variables,
  channelToken,
}: VendureRequestOptions): Promise<T> {
  const token = channelToken ?? (await resolveChannelToken());

  const res = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'vendure-token': token } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Vendure API ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Vendure GraphQL: ${json.errors.map((e) => e.message).join(', ')}`);
  }
  return json.data as T;
}

async function resolveChannelToken(): Promise<string | undefined> {
  const h = await headers();
  const subdomain = h.get('x-frc-subdomain') ?? 'default';
  // TODO: cuando exista tenant-management, mapear subdomain → channelToken
  // via query `tenantBySubdomain`. Por ahora devolver token de env si existe.
  if (subdomain === 'default') return process.env.DEFAULT_CHANNEL_TOKEN;
  return process.env.DEFAULT_CHANNEL_TOKEN;
}
