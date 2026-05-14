'use client';
import { createAuthClient } from 'better-auth/react';

// El cliente usa el origen del browser actual. Esto permite que el mismo bundle
// funcione para cualquier subdominio (multi-tenancy) sin necesidad de
// NEXT_PUBLIC_APP_URL en build time. NEXT_PUBLIC_APP_URL queda como override
// explícito por si se quiere apuntar a otro host.
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : undefined),
});

export const { signIn, signUp, signOut, useSession } = authClient;
