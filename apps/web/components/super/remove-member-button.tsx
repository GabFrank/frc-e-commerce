'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { removeTenantMember } from '@/lib/actions/tenant';

export function RemoveMemberButton({
  tenantId,
  membershipId,
}: {
  tenantId: string;
  membershipId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!confirm('¿Quitar este miembro de la tienda?')) return;
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
