import Link from 'next/link';
import type { ChannelTheme } from '@frc-e-commerce/shared-types';

interface Props {
  theme: ChannelTheme;
}

export function SiteHeader({ theme }: Props) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          {theme.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logoUrl} alt={theme.name} className="h-8 w-auto" />
          ) : null}
          <span className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
            {theme.name}
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/products" className="hover:underline">
            Productos
          </Link>
          <Link href="/cart" className="hover:underline">
            Carrito
          </Link>
          <Link
            href="/account"
            className="rounded-full px-4 py-2 text-white"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Mi cuenta
          </Link>
        </nav>
      </div>
      {theme.slogan ? (
        <div className="bg-zinc-50 py-2 text-center text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {theme.slogan}
        </div>
      ) : null}
    </header>
  );
}
