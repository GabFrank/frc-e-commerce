'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearTenantOverride } from '@/lib/actions/tenant';

export function ExitTenantOverrideButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    await clearTenantOverride();
    router.push('/super');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="block w-full rounded px-2 py-1.5 text-left text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
    >
      {busy ? 'Saliendo…' : '⤴ Salir de modo tienda'}
    </button>
  );
}
