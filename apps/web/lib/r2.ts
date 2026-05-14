import 'server-only';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface UploadResult {
  publicUrl: string;
  key: string;
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicUrlBase = process.env.R2_PUBLIC_URL;

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 no configurado: faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY en env'
    );
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

/**
 * Sube un archivo a R2 desde el servidor (server-to-server, sin CORS).
 * El cliente manda el archivo a nuestro propio backend y este lo reenvía a R2;
 * así evitamos depender de la config CORS del bucket por origen.
 */
export async function uploadR2Object(
  tenantSlug: string,
  filename: string,
  contentType: string,
  body: Buffer | Uint8Array
): Promise<UploadResult> {
  if (!bucket) throw new Error('R2_BUCKET no configurado');
  if (!publicUrlBase) throw new Error('R2_PUBLIC_URL no configurado');

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const key = `tenants/${tenantSlug}/products/${Date.now()}-${safe}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  const publicUrl = `${publicUrlBase.replace(/\/$/, '')}/${key}`;
  return { publicUrl, key };
}

/**
 * Borra un objeto en R2 por key. Llamar cuando se elimina una imagen de la DB.
 */
export async function deleteR2Object(key: string): Promise<void> {
  if (!bucket) throw new Error('R2_BUCKET no configurado');
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function buildPublicUrl(key: string): string {
  if (!publicUrlBase) throw new Error('R2_PUBLIC_URL no configurado');
  return `${publicUrlBase.replace(/\/$/, '')}/${key}`;
}
