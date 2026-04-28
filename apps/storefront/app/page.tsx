import Link from 'next/link';

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="rounded-3xl bg-zinc-50 p-12 text-center dark:bg-zinc-900">
        <h1
          className="text-4xl font-bold tracking-tight sm:text-5xl"
          style={{ color: 'var(--color-primary)' }}
        >
          Tu tienda online
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Plataforma SaaS de e-commerce multitienda — ropa, calzado y accesorios.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/products"
            className="rounded-full px-6 py-3 text-white"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Ver productos
          </Link>
        </div>
      </section>
    </div>
  );
}
