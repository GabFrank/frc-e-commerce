'use server';

import { isRedirectError } from '@/lib/actions/_redirect-helper';
import { requireTenantMembership } from '@/lib/auth/guards';
import { requireTenant } from '@/lib/tenant';
import { getPresignedUploadUrl, type PresignedUploadResult } from '@/lib/r2';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export type PresignResult =
  | ({ ok: true } & PresignedUploadResult)
  | { ok: false; error: string };

export async function presignProductImageUpload(
  filename: string,
  contentType: string,
  size: number
): Promise<PresignResult> {
  try {
    const tenant = await requireTenant();
    await requireTenantMembership(tenant.id);

    if (!contentType.startsWith('image/')) {
      return { ok: false, error: 'Solo se permiten imágenes' };
    }
    if (size > MAX_FILE_SIZE) {
      return { ok: false, error: `Archivo muy grande (máx ${MAX_FILE_SIZE / 1024 / 1024} MB)` };
    }

    const r = await getPresignedUploadUrl(tenant.slug, filename, contentType);
    return { ok: true, ...r };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}
