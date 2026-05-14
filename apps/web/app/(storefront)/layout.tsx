import { getCurrentTenant } from '@/lib/tenant';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';

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
      <StorefrontHeader tenantName={tenant?.name ?? 'FRC E-commerce'} />
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          {tenant ? `© ${tenant.name}` : '© FRC E-commerce'} — Powered by FRC
        </div>
      </footer>
    </div>
  );
}
