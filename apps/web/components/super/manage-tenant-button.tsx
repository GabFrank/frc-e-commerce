'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { switchToTenant, selfAssignAsOwner, stageTenantOverride } from '@/lib/actions/tenant';
import { authClient } from '@/lib/auth/client';

export interface ManageTenantButtonProps {
  tenantId: string;
  tenantName: string;
  hasMembership: boolean;
  currentUserEmail: string;
}

export function ManageTenantButton({
  tenantId,
  tenantName,
  hasMembership,
  currentUserEmail,
}: ManageTenantButtonProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePrimary = async () => {
    if (hasMembership) {
      setBusy(true);
      try {
        await switchToTenant(tenantId);
      } catch (err) {
        if ((err as { digest?: string })?.digest?.startsWith?.('NEXT_REDIRECT')) return;
        setError(err instanceof Error ? err.message : 'Error');
        setBusy(false);
      }
    } else {
      setShowDialog(true);
    }
  };

  const handleSelfAssign = async () => {
    setBusy(true);
    setError(null);
    const res = await selfAssignAsOwner(tenantId);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    try {
      await switchToTenant(tenantId);
    } catch (err) {
      if ((err as { digest?: string })?.digest?.startsWith?.('NEXT_REDIRECT')) return;
      setError(err instanceof Error ? err.message : 'Error');
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      // Persistir el tenant elegido antes del logout para que el próximo
      // login aterrice directo en su /admin
      await stageTenantOverride(tenantId);
      await authClient.signOut();
      const redirectTo = encodeURIComponent('/admin');
      router.push(`/login?redirect=${redirectTo}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar sesión');
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={handlePrimary} disabled={busy}>
        {busy ? 'Procesando…' : `Administrar ${tenantName}`}
      </Button>

      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setShowDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card text-card-foreground p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Sin acceso a esta tienda</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu cuenta <span className="font-medium">{currentUserEmail}</span> no es
              miembro de <span className="font-medium">{tenantName}</span>.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Como super admin, podés agregarte como <span className="font-medium">owner</span>{' '}
              de esta tienda, o cambiar a una cuenta que ya sea miembro.
            </p>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={handleSelfAssign} disabled={busy} className="w-full">
                {busy ? 'Asignando...' : 'Agregarme como owner y entrar'}
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={busy}
                className="w-full"
              >
                Cerrar sesión y entrar con otro usuario
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDialog(false)}
                disabled={busy}
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
