/* eslint-disable no-console */
/**
 * Seed script — crea productos demo para validar el storefront end-to-end.
 *
 * Uso:
 *   ADMIN_USER=superadmin ADMIN_PASS=superadmin pnpm tsx scripts/seed-demo-products.ts
 *
 * Asume que el backend está corriendo en http://localhost:3000.
 * No idempotente — corré contra DB limpia.
 */

const ADMIN_API = process.env.ADMIN_API_URL ?? 'http://localhost:3000/admin-api';
const USER = process.env.ADMIN_USER ?? 'superadmin';
const PASS = process.env.ADMIN_PASS ?? 'superadmin';

interface DemoProduct {
  name: string;
  slug: string;
  description: string;
  variants: Array<{
    sku: string;
    name: string;
    price: number;
    optionGroups?: Array<{ code: string; name: string; option: string }>;
  }>;
}

const PRODUCTS: DemoProduct[] = [
  {
    name: 'Remera Básica',
    slug: 'remera-basica',
    description: '<p>Remera de algodón 100%, corte clásico.</p>',
    variants: [
      { sku: 'REM-S-NEG', name: 'S Negro', price: 8000000 },
      { sku: 'REM-M-NEG', name: 'M Negro', price: 8000000 },
      { sku: 'REM-L-NEG', name: 'L Negro', price: 8000000 },
    ],
  },
  {
    name: 'Jean Slim Fit',
    slug: 'jean-slim-fit',
    description: '<p>Jean elastizado, calce slim.</p>',
    variants: [
      { sku: 'JEAN-38', name: 'Talle 38', price: 18000000 },
      { sku: 'JEAN-40', name: 'Talle 40', price: 18000000 },
      { sku: 'JEAN-42', name: 'Talle 42', price: 18000000 },
    ],
  },
  {
    name: 'Zapatilla Urbana',
    slug: 'zapatilla-urbana',
    description: '<p>Suela de goma, ideal uso diario.</p>',
    variants: [
      { sku: 'ZAP-39', name: 'Talle 39', price: 25000000 },
      { sku: 'ZAP-40', name: 'Talle 40', price: 25000000 },
      { sku: 'ZAP-41', name: 'Talle 41', price: 25000000 },
    ],
  },
  {
    name: 'Mochila Cuero',
    slug: 'mochila-cuero',
    description: '<p>Cuero genuino, capacidad 18L.</p>',
    variants: [{ sku: 'MOC-MARRON', name: 'Marrón', price: 35000000 }],
  },
];

interface GraphQLResult<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

async function gql<T>(token: string | null, query: string, variables: unknown = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['vendure-auth-token'] = token;

  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GraphQLResult<T>;
  if (json.errors) {
    throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return json.data as T;
}

async function login(): Promise<string> {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: /* GraphQL */ `
        mutation Login($u: String!, $p: String!) {
          login(username: $u, password: $p) {
            ... on CurrentUser {
              id
            }
            ... on ErrorResult {
              errorCode
              message
            }
          }
        }
      `,
      variables: { u: USER, p: PASS },
    }),
  });
  const token = res.headers.get('vendure-auth-token');
  if (!token) throw new Error('No vendure-auth-token after login');
  console.log('login OK');
  return token;
}

async function createProduct(token: string, p: DemoProduct): Promise<string> {
  const data = await gql<{ createProduct: { id: string } }>(
    token,
    /* GraphQL */ `
      mutation CreateProduct($input: CreateProductInput!) {
        createProduct(input: $input) {
          id
        }
      }
    `,
    {
      input: {
        translations: [
          {
            languageCode: 'es',
            name: p.name,
            slug: p.slug,
            description: p.description,
          },
        ],
      },
    },
  );
  console.log(`  product ${p.slug} → ${data.createProduct.id}`);
  return data.createProduct.id;
}

async function createVariants(
  token: string,
  productId: string,
  p: DemoProduct,
): Promise<void> {
  for (const v of p.variants) {
    await gql(
      token,
      /* GraphQL */ `
        mutation CreateProductVariants($input: [CreateProductVariantInput!]!) {
          createProductVariants(input: $input) {
            id
            sku
          }
        }
      `,
      {
        input: [
          {
            productId,
            sku: v.sku,
            price: v.price,
            translations: [{ languageCode: 'es', name: v.name }],
            optionIds: [],
            taxCategoryId: '1',
            stockOnHand: 100,
          },
        ],
      },
    );
    console.log(`    variant ${v.sku}`);
  }
}

async function main() {
  console.log(`Seeding ${PRODUCTS.length} products to ${ADMIN_API}`);
  const token = await login();
  for (const p of PRODUCTS) {
    const productId = await createProduct(token, p);
    await createVariants(token, productId, p);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
