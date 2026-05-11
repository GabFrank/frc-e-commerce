import { NextRequest, NextResponse } from 'next/server';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'frc-ecommerce.com';

export function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const slug = extractSlug(host);
  const res = NextResponse.next();
  if (slug) res.headers.set('x-frc-tenant-slug', slug);
  return res;
}

function extractSlug(host: string): string | null {
  const clean = host.split(':')[0];
  if (!clean) return null;
  if (clean === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(clean)) return null;
  if (clean === `app.${ROOT_DOMAIN}`) return null;
  const parts = clean.split('.');
  if (parts.length >= 3 && clean.endsWith(ROOT_DOMAIN)) {
    return parts[0] ?? null;
  }
  return null;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
