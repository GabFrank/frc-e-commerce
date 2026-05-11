'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { archiveProduct, deleteProduct } from '@/lib/actions/product';

export function ProductDangerZone({
  productId,
  productName,
  productStatus,
}: {
  productId: string;
  productName: string;
  productStatus: 'draft' | 'active' | 'archived';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onArchive = () => {
    if (productStatus === 'archived') {
      alert('Este producto ya está archivado.');
      return;
    }
    if (
      !confirm(
        `¿Archivar "${productName}"?\n\nQueda oculto del POS y la tienda pública, pero la data histórica se conserva. Podés reactivarlo después editando el estado.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await archiveProduct(productId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onDelete = () => {
    if (
      !confirm(
        `¿Eliminar definitivamente "${productName}"?\n\nSolo se puede eliminar si NUNCA fue vendido, comprado o tuvo movimientos de stock. Esta acción no se puede deshacer.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteProduct(productId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Borrado OK → volver a la lista
      router.push('/admin/productos');
    });
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Zona peligrosa</CardTitle>
        <CardDescription>
          Acciones que afectan la visibilidad o existencia del producto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col items-start gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium">Archivar producto</p>
            <p className="text-xs text-muted-foreground">
              Lo oculta del POS y storefront. Mantiene su historia. Reversible.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onArchive}
            disabled={pending || productStatus === 'archived'}
          >
            <Archive className="mr-1 h-3.5 w-3.5" />
            {productStatus === 'archived' ? 'Ya archivado' : 'Archivar'}
          </Button>
        </div>

        <div className="flex flex-col items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium text-destructive">Eliminar definitivamente</p>
            <p className="text-xs text-muted-foreground">
              Solo posible si el producto nunca tuvo ventas, compras o movimientos de stock.
              Acción no reversible.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={pending}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
