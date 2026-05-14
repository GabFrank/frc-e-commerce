import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import * as schema from '@frc-e-commerce/db/schema';

// COOKIE_DOMAIN permite compartir la sesión entre subdominios (multi-tenancy).
// Ej: ".frc-ecommerce.com" permite que la sesión persista al saltar de
// app.frc-ecommerce.com a frc.frc-ecommerce.com.
const COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  trustedOrigins: buildTrustedOrigins(),
  ...(COOKIE_DOMAIN
    ? {
        advanced: {
          crossSubDomainCookies: {
            enabled: true,
            domain: COOKIE_DOMAIN,
          },
        },
      }
    : {}),
});

function buildTrustedOrigins(): string[] {
  const base =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';
  const origins = new Set<string>([base]);

  // BETTER_AUTH_TRUSTED_ORIGINS permite agregar orígenes extra separados por
  // coma. Soporta wildcards de better-auth (ej. "https://*.frc-ecommerce.com").
  const extra = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (extra) {
    for (const o of extra.split(',')) {
      const trimmed = o.trim();
      if (trimmed) origins.add(trimmed);
    }
  }
  return [...origins];
}

export type Session = typeof auth.$Infer.Session;
