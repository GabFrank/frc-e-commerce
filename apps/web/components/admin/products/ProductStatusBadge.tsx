import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';

type ProductStatus = 'draft' | 'active' | 'archived';

const statusConfig: Record<ProductStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  active: { label: 'Activo', variant: 'success' },
  archived: { label: 'Archivado', variant: 'outline' },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { label, variant } = statusConfig[status] ?? statusConfig.draft;
  return <Badge variant={variant}>{label}</Badge>;
}
