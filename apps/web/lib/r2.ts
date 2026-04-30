// TODO: replace with real R2 presigned URL when AWS SDK installed

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/**
 * Returns a presigned URL for uploading a file to R2.
 *
 * Currently a stub — the uploadUrl is empty and the publicUrl points to a
 * placeholder image. Replace with a real S3-compatible presigned-URL flow once
 * @aws-sdk/client-s3 is installed.
 */
export async function getPresignedUploadUrl(
  tenantSlug: string,
  filename: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _contentType: string
): Promise<PresignedUploadResult> {
  const key = `stub/${tenantSlug}/${Date.now()}-${filename}`;
  return {
    uploadUrl: '',
    publicUrl: `https://placehold.co/600x600?text=${encodeURIComponent(filename)}`,
    key,
  };
}

/**
 * Builds the public CDN URL for an R2 object key.
 * Requires the R2_PUBLIC_URL env var (e.g. https://assets.frc-ecommerce.com).
 */
export function buildPublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL ?? '';
  return `${base}/${key}`;
}
