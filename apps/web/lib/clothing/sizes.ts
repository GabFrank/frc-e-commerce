/**
 * Catálogo hardcoded de géneros y talles para la tienda de ropa.
 * Si en el futuro hace falta padrones por tenant, migrar a tabla `size_template`.
 */

export const GENDERS = [
  { code: 'masculino', label: 'Masculino', short: 'M' },
  { code: 'femenino', label: 'Femenino', short: 'F' },
  { code: 'unisex', label: 'Unisex', short: 'U' },
  { code: 'infantil', label: 'Infantil', short: 'I' },
] as const;

export type Gender = (typeof GENDERS)[number]['code'];

export const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const KIDS_SIZES = ['2', '4', '6', '8', '10', '12', '14', '16'] as const;

export type SizeKind = 'letter_adult' | 'number_kids';

export type SizeCatalog = {
  kind: SizeKind;
  values: readonly string[];
};

export function sizeCatalogFor(gender: Gender): SizeCatalog {
  return gender === 'infantil'
    ? { kind: 'number_kids', values: KIDS_SIZES }
    : { kind: 'letter_adult', values: ADULT_SIZES };
}

export function isValidSize(size: string, kind: SizeKind): boolean {
  if (kind === 'number_kids') return KIDS_SIZES.includes(size as (typeof KIDS_SIZES)[number]);
  return ADULT_SIZES.includes(size as (typeof ADULT_SIZES)[number]);
}

export function formatGender(g: Gender | null | undefined): string {
  if (!g) return '';
  return GENDERS.find((x) => x.code === g)?.label ?? g;
}

export function formatSize(size: string | null | undefined): string {
  if (!size) return '';
  return `Talle ${size}`;
}

/**
 * Display canónico de una variante: "Rojo · Talle M" / "Talle 10" / "Rojo" / "—".
 */
export function formatVariantDisplay(
  color: string | null | undefined,
  size: string | null | undefined
): string {
  const parts: string[] = [];
  if (color) parts.push(color);
  if (size) parts.push(`Talle ${size}`);
  return parts.length === 0 ? '—' : parts.join(' · ');
}
