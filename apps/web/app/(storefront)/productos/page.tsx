import { notFound } from 'next/navigation';
import { getCurrentTenant } from '@/lib/tenant';
import { ProductCard } from '@/components/storefront/product-card';

// TODO: enable when product schema is added (Agent A)
// import { db } from '@/lib/db';
// import { product, category } from '@frc-e-commerce/db/schema';
// import { and, eq, ilike, asc, desc } from 'drizzle-orm';

// Placeholder types until Agent A delivers schema
interface PlaceholderProduct {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  currency: string;
  imageUrl: string | null;
  categoryId: string | null;
}

interface PlaceholderCategory {
  id: string;
  name: string;
  slug: string;
}

// Placeholder data for development
const PLACEHOLDER_CATEGORIES: PlaceholderCategory[] = [
  { id: 'cat-1', name: 'Remeras', slug: 'remeras' },
  { id: 'cat-2', name: 'Pantalones', slug: 'pantalones' },
  { id: 'cat-3', name: 'Calzado', slug: 'calzado' },
  { id: 'cat-4', name: 'Accesorios', slug: 'accesorios' },
];

const PLACEHOLDER_PRODUCTS: PlaceholderProduct[] = [
  { id: '1', slug: 'remera-basica', name: 'Remera básica', basePrice: 150000, currency: 'PYG', imageUrl: null, categoryId: 'cat-1' },
  { id: '2', slug: 'remera-estampada', name: 'Remera estampada', basePrice: 180000, currency: 'PYG', imageUrl: null, categoryId: 'cat-1' },
  { id: '3', slug: 'pantalon-jean', name: 'Pantalón jean', basePrice: 280000, currency: 'PYG', imageUrl: null, categoryId: 'cat-2' },
  { id: '4', slug: 'pantalon-cargo', name: 'Pantalón cargo', basePrice: 250000, currency: 'PYG', imageUrl: null, categoryId: 'cat-2' },
  { id: '5', slug: 'zapatillas-urban', name: 'Zapatillas urban', basePrice: 420000, currency: 'PYG', imageUrl: null, categoryId: 'cat-3' },
  { id: '6', slug: 'buzo-hoodie', name: 'Buzo hoodie', basePrice: 320000, currency: 'PYG', imageUrl: null, categoryId: 'cat-1' },
  { id: '7', slug: 'gorra-cap', name: 'Gorra cap', basePrice: 90000, currency: 'PYG', imageUrl: null, categoryId: 'cat-4' },
  { id: '8', slug: 'cinturon-cuero', name: 'Cinturón de cuero', basePrice: 120000, currency: 'PYG', imageUrl: null, categoryId: 'cat-4' },
];

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

  // TODO: enable when product schema is added (Agent A)
  // const conditions = [
  //   eq(product.tenantId, tenant.id),
  //   eq(product.status, 'active'),
  // ];
  // if (categorySlug) {
  //   const [cat] = await db
  //     .select({ id: category.id })
  //     .from(category)
  //     .where(and(eq(category.tenantId, tenant.id), eq(category.slug, categorySlug)))
  //     .limit(1);
  //   if (cat) conditions.push(eq(product.categoryId, cat.id));
  // }
  // if (query) conditions.push(ilike(product.name, `%${query}%`));
  // const orderBy = sort === 'price_asc'
  //   ? asc(product.basePrice)
  //   : sort === 'price_desc'
  //     ? desc(product.basePrice)
  //     : asc(product.name);
  // const offset = (page - 1) * PAGE_SIZE;
  // const products = await db
  //   .select()
  //   .from(product)
  //   .where(and(...conditions))
  //   .orderBy(orderBy)
  //   .limit(PAGE_SIZE)
  //   .offset(offset);
  // const categories = await db
  //   .select()
  //   .from(category)
  //   .where(eq(category.tenantId, tenant.id));

  // Placeholder filtering/sorting
  const categories = PLACEHOLDER_CATEGORIES;
  let products = [...PLACEHOLDER_PRODUCTS];

  if (query) {
    products = products.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );
  }
  if (categorySlug) {
    const cat = categories.find((c) => c.slug === categorySlug);
    if (cat) products = products.filter((p) => p.categoryId === cat.id);
  }
  if (sort === 'price_asc') products.sort((a, b) => a.basePrice - b.basePrice);
  else if (sort === 'price_desc') products.sort((a, b) => b.basePrice - a.basePrice);
  else products.sort((a, b) => a.name.localeCompare(b.name));

  const totalCount = products.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;
  const paginatedProducts = products.slice(offset, offset + PAGE_SIZE);

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
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-zinc-400">
              <p className="text-sm">No se encontraron productos.</p>
              {query && (
                <a href="/productos" className="text-xs underline">
                  Limpiar búsqueda
                </a>
              )}
            </div>
          ) : (
            <>
              <p className="mb-4 text-xs text-zinc-500">
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
      className={`block rounded px-2 py-1 transition-colors hover:bg-zinc-100 ${
        active ? 'font-medium text-primary' : 'text-zinc-700'
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
      className={`block rounded px-2 py-1 transition-colors hover:bg-zinc-100 ${
        active ? 'font-medium text-primary' : 'text-zinc-700'
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
          : 'border hover:bg-zinc-50 text-zinc-700'
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
