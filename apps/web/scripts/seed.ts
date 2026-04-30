import { config } from 'dotenv';
import { eq } from 'drizzle-orm';

config({ path: '.env.local' });
config({ path: '.env' });

async function main() {
  const { auth } = await import('../lib/auth/index.js');
  const { db } = await import('../lib/db.js');
  const { user, tenant, tenantMember } = await import('@frc-e-commerce/db/schema');

  const SUPER_EMAIL = process.env.SEED_SUPER_EMAIL ?? 'super@frc-ecommerce.com';
  const SUPER_PASSWORD = process.env.SEED_SUPER_PASSWORD ?? 'superadmin123';

  console.log('Seed iniciado');

  // 1. Superadmin
  const [existingSuper] = await db.select().from(user).where(eq(user.email, SUPER_EMAIL)).limit(1);
  let superUserId: string;
  if (existingSuper) {
    superUserId = existingSuper.id;
    console.log('Superadmin ya existe:', SUPER_EMAIL);
  } else {
    const result = await auth.api.signUpEmail({
      body: { email: SUPER_EMAIL, password: SUPER_PASSWORD, name: 'Super Admin' },
    });
    if (!result.user) throw new Error('No se pudo crear superadmin');
    superUserId = result.user.id;
    await db.update(user).set({ isSuperAdmin: true }).where(eq(user.id, superUserId));
    console.log('Superadmin creado:', SUPER_EMAIL, '/', SUPER_PASSWORD);
  }

  // 2. Tenant demo
  const [existingDemo] = await db.select().from(tenant).where(eq(tenant.slug, 'demo')).limit(1);
  let demoTenantId: string;
  if (existingDemo) {
    demoTenantId = existingDemo.id;
    console.log('Tenant demo ya existe');
  } else {
    const [created] = await db
      .insert(tenant)
      .values({
        name: 'Tienda Demo',
        slug: 'demo',
        plan: 'free',
        slogan: 'Probá la plataforma',
        primaryColor: '#1f2937',
        secondaryColor: '#6b7280',
        accentColor: '#3b82f6',
      })
      .returning();
    if (!created) throw new Error('No se pudo crear tenant demo');
    demoTenantId = created.id;
    console.log('Tenant demo creado:', demoTenantId);
  }

  // 3. Membership owner
  const [existingMembership] = await db
    .select()
    .from(tenantMember)
    .where(eq(tenantMember.tenantId, demoTenantId))
    .limit(1);
  if (!existingMembership) {
    await db.insert(tenantMember).values({
      tenantId: demoTenantId,
      userId: superUserId,
      role: 'owner',
    });
    console.log('Membership owner creado');
  }

  console.log('Seed completado.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
