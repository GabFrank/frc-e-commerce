import { notFound } from 'next/navigation';
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { getCurrentTenant } from '@/lib/tenant';
import { ProductCard } from '@/components/storefront/product-card';
import { db } from '@/lib/db';
import { product, productImage, category } from '@frc-e-commerce/db/schema';

const PAGE_SIZE = 12;

interface ProductosPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    q?: string;
    sort?: string;
  }>;
}

export default async function ProductosPage({ searchParams }: ProductosPageProps) {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) notFound();

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const categorySlug = params.category ?? '';
  const query = params.q ?? '';
  const sort = params.sort ?? 'name_asc';

  const conditions = [eq(product.tenantId, tenant.id), eq(product.status, 'active')];

  let categoryId: string | null = null;
  if (categorySlug) {
    const [cat] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.tenantId, tenant.id), eq(category.slug, categorySlug)))
      .limit(1);
    if (cat) {
      categoryId = cat.id;
      conditions.push(eq(product.categoryId, cat.id));
    }
  }
  if (query) conditions.push(ilike(product.name, `%${query}%`));

  const orderBy =
    sort === 'price_asc'
      ? asc(product.basePrice)
      : sort === 'price_desc'
        ? desc(product.basePrice)
        : asc(product.name);

  const [{ value: totalCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(product)
    .where(and(...conditions));

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;

  const productsRaw = await db
    .select()
    .from(product)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset(offset);

  // Trae primera imagen de cada producto
  const productIds = productsRaw.map((p) => p.id);
  const images = productIds.length
    ? await db
        .select()
        .from(productImage)
        .where(and(eq(productImage.tenantId, tenant.id)))
    : [];
  const firstImageByProduct = new Map<string, string>();
  for (const img of images.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    if (!firstImageByProduct.has(img.productId)) {
      firstImageByProduct.set(img.productId, img.url);
    }
  }

  const paginatedProducts = productsRaw.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    basePrice: p.basePrice,
    currency: p.currency,
    imageUrl: firstImageByProduct.get(p.id) ?? null,
  }));

  const categories = await db
    .select({ id: category.id, name: category.name, slug: category.slug })
    .from(category)
    .where(eq(category.tenantId, tenant.id))
    .orderBy(asc(category.name));

  void categoryId;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Productos</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar filtros */}
        <aside className="lg:w-56 shrink-0">
          <div className="space-y-6 rounded-xl border p-4">
            {/* Búsqueda */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Buscar</h3>
              <SearchForm defaultValue={query} />
            </div>

            {/* Categorías */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Categorías</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <CategoryLink slug="" label="Todas" active={!categorySlug} currentQuery={query} currentSort={sort} />
                </li>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <CategoryLink
                      slug={cat.slug}
                      label={cat.name}
                      active={categorySlug === cat.slug}
                      currentQuery={query}
                      currentSort={sort}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {/* Orden */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Ordenar por</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <SortLink value="name_asc" label="Nombre A-Z" active={sort === 'name_asc'} currentQuery={query} currentCategory={categorySlug} />
                </li>
                <li>
                  <SortLink value="price_asc" label="Precio: menor a mayor" active={sort === 'price_asc'} currentQuery={query} currentCategory={categorySlug} />
                </li>
                <li>
                  <SortLink value="price_desc" label="Precio: mayor a menor" active={sort === 'price_desc'} currentQuery={query} currentCategory={categorySlug} />
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Grid de productos */}
        <div className="flex-1">
          {paginatedProducts.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-muted-foreground/80">
              <p className="text-sm">No se encontraron productos.</p>
              {query && (
                <a href="/productos" className="text-xs underline">
                  Limpiar búsqueda
                </a>
              )}
            </div>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">
                {totalCount} {totalCount === 1 ? 'producto' : 'productos'} encontrados
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {paginatedProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    slug={p.slug}
                    name={p.name}
                    basePrice={p.basePrice}
                    currency={p.currency}
                    imageUrl={p.imageUrl}
                  />
                ))}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <PaginationLink
                      key={n}
                      page={n}
                      active={n === page}
                      query={query}
                      category={categorySlug}
                      sort={sort}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Small server-renderable UI helpers

function buildHref({
  page,
  category,
  q,
  sort,
}: {
  page?: number;
  category?: string;
  q?: string;
  sort?: string;
}): string {
  const params = new URLSearchParams();
  if (page && page > 1) params.set('page', String(page));
  if (category) params.set('category', category);
  if (q) params.set('q', q);
  if (sort && sort !== 'name_asc') params.set('sort', sort);
  const qs = params.toString();
  return `/productos${qs ? `?${qs}` : ''}`;
}

function CategoryLink({
  slug,
  label,
  active,
  currentQuery,
  currentSort,
}: {
  slug: string;
  label: string;
  active: boolean;
  currentQuery: string;
  currentSort: string;
}) {
  const href = buildHref({ category: slug, q: currentQuery, sort: currentSort });
  return (
    <a
      href={href}
      className={`block rounded px-2 py-1 transition-colors hover:bg-muted ${
        active ? 'font-medium text-primary' : 'text-foreground/80'
      }`}
    >
      {label}
    </a>
  );
}

function SortLink({
  value,
  label,
  active,
  currentQuery,
  currentCategory,
}: {
  value: string;
  label: string;
  active: boolean;
  currentQuery: string;
  currentCategory: string;
}) {
  const href = buildHref({ category: currentCategory, q: currentQuery, sort: value });
  return (
    <a
      href={href}
      className={`block rounded px-2 py-1 transition-colors hover:bg-muted ${
        active ? 'font-medium text-primary' : 'text-foreground/80'
      }`}
    >
      {label}
    </a>
  );
}

function PaginationLink({
  page,
  active,
  query,
  category,
  sort,
}: {
  page: number;
  active: boolean;
  query: string;
  category: string;
  sort: string;
}) {
  const href = buildHref({ page, q: query, category, sort });
  return (
    <a
      href={href}
      className={`flex h-8 w-8 items-center justify-center rounded text-sm transition-colors ${
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'border hover:bg-muted/50 text-foreground/80'
      }`}
    >
      {page}
    </a>
  );
}

// Search needs a form — done without 'use client' using standard HTML form
function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form action="/productos" method="get">
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder="Buscar productos..."
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <button
        type="submit"
        className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Buscar
      </button>
    </form>
  );
}
