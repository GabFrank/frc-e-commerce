'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { enterTenantAsMember } from '@/lib/actions/tenant';

export function EnterTenantButton({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      await enterTenantAsMember(tenantId);
    } catch (err) {
      if ((err as { digest?: string })?.digest?.startsWith?.('NEXT_REDIRECT')) return;
      setError(err instanceof Error ? err.message : 'Error');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={busy}>
        {busy ? 'Entrando…' : `Entrar a ${tenantName}`}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
