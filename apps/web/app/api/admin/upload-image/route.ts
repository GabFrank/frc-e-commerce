import { NextResponse } from 'next/server';
import { getSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { uploadR2Object } from '@/lib/r2';

// Sube imágenes de producto a R2 vía proxy server-side. El browser POSTea el
// archivo a nuestro propio origin (same-origin, sin CORS) y el server lo
// reenvía a R2. Reemplaza el flujo viejo de presigned URL + PUT directo, que
// fallaba con "failed to fetch" en subdominios de tenant no whitelisteados
// en la config CORS del bucket.
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: 'Sin contexto de tienda' },
        { status: 400 }
      );
    }

    const membership = await getMembership(session.user.id, tenant.id);
    if (!membership) {
      return NextResponse.json(
        { ok: false, error: 'Sin acceso a esta tienda' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Falta el archivo' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { ok: false, error: 'Solo se permiten imágenes' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: `Archivo muy grande (máx ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, publicUrl } = await uploadR2Object(
      tenant.slug,
      file.name,
      file.type,
      buffer
    );

    return NextResponse.json({ ok: true, key, url: publicUrl });
  } catch (err) {
    console.error('[upload-image] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error inesperado al subir' },
      { status: 500 }
    );
  }
}
