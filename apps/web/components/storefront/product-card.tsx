import Link from 'next/link';
import { formatMoney } from '@frc-e-commerce/shared-utils';
import type { CurrencyCode } from '@frc-e-commerce/shared-utils';
import { cn } from '@/lib/utils/cn';
import { SafeImage } from './safe-image';

export interface ProductCardProps {
  slug: string;
  name: string;
  basePrice: number;
  currency: string;
  imageUrl?: string | null;
  className?: string;
}

export function ProductCard({ slug, name, basePrice, currency, imageUrl, className }: ProductCardProps) {
  const formattedPrice = formatMoney({
    amount: basePrice,
    currency: currency as CurrencyCode,
  });

  return (
    <Link href={`/productos/${slug}`} className={cn('group block', className)}>
      <div className="overflow-hidden rounded-xl border bg-card shadow transition-shadow hover:shadow-md">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {imageUrl ? (
            <SafeImage
              src={imageUrl}
              alt={name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/60">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="line-clamp-2 text-sm font-medium text-card-foreground">{name}</p>
          <p className="mt-1 text-sm font-semibold text-primary">{formattedPrice}</p>
        </div>
      </div>
    </Link>
  );
}
