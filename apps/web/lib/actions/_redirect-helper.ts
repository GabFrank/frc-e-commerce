/**
 * Helper para identificar errores que en realidad son redirects de Next.js.
 * Estos errores tienen una propiedad `digest` que empieza con `NEXT_REDIRECT`
 * (o `NEXT_NOT_FOUND` para `notFound()`) y deben propagarse al runtime de
 * Next.js — NO ser tragados por un `try/catch`.
 *
 * Uso:
 *   try { await guardTenant(); ... }
 *   catch (err) {
 *     if (isRedirectError(err)) throw err;  // dejar que Next maneje el redirect
 *     return { ok: false, error: ... };
 *   }
 */
export function isRedirectError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest !== 'string') return false;
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND');
}
