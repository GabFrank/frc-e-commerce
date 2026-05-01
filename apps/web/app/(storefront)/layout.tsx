import Link from 'next/link';
import { getCurrentTenant } from '@/lib/tenant';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant().catch(() => null);

  const themeStyle = tenant
    ? ({
        '--tenant-primary': tenant.primaryColor ?? '#1f2937',
        '--tenant-secondary': tenant.secondaryColor ?? '#6b7280',
        '--tenant-accent': tenant.accentColor ?? '#3b82f6',
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-screen flex-col" style={themeStyle}>
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link href="/" className="font-semibold">
            {tenant?.name ?? 'FRC E-commerce'}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/productos" className="hover:underline">Productos</Link>
            <Link href="/carrito" className="hover:underline">Carrito</Link>
            <Link href="/cuenta" className="hover:underline">Cuenta</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl p-4 text-xs text-zinc-500">
          {tenant ? `© ${tenant.name}` : '© FRC E-commerce'} — Powered by FRC
        </div>
      </footer>
    </div>
  );
}
