'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { removeTenantMember } from '@/lib/actions/tenant';

export function RemoveMemberButton({
  tenantId,
  membershipId,
}: {
  tenantId: string;
  membershipId: string;
}) {
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();

  const handleClick = async () => {
    const ok = await confirm({
      title: 'Quitar miembro',
      description: '¿Quitar este miembro de la tienda?',
      confirmLabel: 'Quitar',
      variant: 'destructive',
    });
    if (!ok) return;
    setLoading(true);
    await removeTenantMember(tenantId, membershipId);
    setLoading(false);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={loading}>
      Quitar
    </Button>
  );
}
