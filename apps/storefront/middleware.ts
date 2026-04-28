import { NextRequest, NextResponse } from 'next/server';

/**
 * Resuelve el subdominio del request y lo expone como header para uso en
 * server components / route handlers. El backend Vendure lo traduce a
 * channelToken vía plugin tenant-management.
 *
 * En localhost (sin subdominio), devuelve `default`.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const subdomain = extractSubdomain(host);

  const res = NextResponse.next();
  res.headers.set('x-frc-subdomain', subdomain);
  return res;
}

function extractSubdomain(host: string): string {
  const cleanHost = host.split(':')[0];
  if (cleanHost === 'localhost' || cleanHost.startsWith('127.')) return 'default';
  const parts = cleanHost.split('.');
  if (parts.length < 3) return 'default';
  return parts[0];
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
