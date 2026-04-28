import { vendureRequest } from './vendure-client';

export interface ProductSummary {
  id: string;
  productId: string;
  productName: string;
  slug: string;
  description: string;
  productAsset: { id: string; preview: string } | null;
  priceWithTax: { min: number; max: number };
  currencyCode: string;
}

interface ProductDetailResponse {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    featuredAsset: { id: string; preview: string } | null;
    assets: Array<{ id: string; preview: string }>;
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      priceWithTax: number;
      currencyCode: string;
      stockLevel: string;
    }>;
  } | null;
}

export async function searchProducts(term = ''): Promise<ProductSummary[]> {
  try {
    const data = await vendureRequest<{
      search: { items: ProductSummary[] };
    }>({
      query: /* GraphQL */ `
        query Search($input: SearchInput!) {
          search(input: $input) {
            items {
              productId
              productName
              slug
              description
              productAsset {
                id
                preview
              }
              priceWithTax {
                ... on PriceRange {
                  min
                  max
                }
                ... on SinglePrice {
                  value
                }
              }
              currencyCode
            }
          }
        }
      `,
      variables: { input: { term, take: 24, groupByProduct: true } },
    });
    return data.search.items.map((it) => {
      const price = it.priceWithTax as
        | { min: number; max: number }
        | { value: number };
      return {
        ...it,
        id: it.productId,
        priceWithTax:
          'min' in price ? price : { min: price.value, max: price.value },
      };
    });
  } catch (err) {
    console.warn('[storefront] searchProducts failed:', err);
    return [];
  }
}

export async function getProductBySlug(slug: string) {
  try {
    const data = await vendureRequest<ProductDetailResponse>({
      query: /* GraphQL */ `
        query ProductBySlug($slug: String!) {
          product(slug: $slug) {
            id
            name
            slug
            description
            featuredAsset {
              id
              preview
            }
            assets {
              id
              preview
            }
            variants {
              id
              name
              sku
              priceWithTax
              currencyCode
              stockLevel
            }
          }
        }
      `,
      variables: { slug },
    });
    return data.product;
  } catch (err) {
    console.warn('[storefront] getProductBySlug failed:', err);
    return null;
  }
}
