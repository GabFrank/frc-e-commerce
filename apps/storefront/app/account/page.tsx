export const dynamic = 'force-dynamic';

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
        Mi cuenta
      </h1>
      <p className="mt-4 text-zinc-500">
        Login / registro pendiente. Vendure Shop API mutations: login, registerCustomerAccount.
      </p>
    </div>
  );
}
