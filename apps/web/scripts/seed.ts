import { config } from 'dotenv';
import { eq } from 'drizzle-orm';

config({ path: '.env.local' });
config({ path: '.env' });

async function main() {
  const { auth } = await import('../lib/auth/index.js');
  const { db } = await import('../lib/db.js');
  const {
    user,
    tenant,
    tenantMember,
    currency,
    denomination,
    tenantCurrency,
    exchangeRate,
  } = await import('@frc-e-commerce/db/schema');
  const { and } = await import('drizzle-orm');

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

  // 4. Currencies + denominations (master, idempotente)
  const CURRENCIES = [
    { code: 'PYG', name: 'Guaraní paraguayo', symbol: '₲', decimalPlaces: 0, numericCode: '600' },
    { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', decimalPlaces: 2, numericCode: '840' },
    { code: 'BRL', name: 'Real brasileño', symbol: 'R$', decimalPlaces: 2, numericCode: '986' },
  ] as const;

  for (const c of CURRENCIES) {
    const [existing] = await db.select().from(currency).where(eq(currency.code, c.code)).limit(1);
    if (existing) continue;
    await db.insert(currency).values(c);
    console.log('Currency creada:', c.code);
  }

  // Denominations en MINOR units. PYG decimals=0, USD/BRL decimals=2.
  type Denom = { currencyCode: string; value: number; kind: 'bill' | 'coin'; position: number };
  const DENOMINATIONS: Denom[] = [
    // PYG (sin decimales: value = guaraníes literales)
    { currencyCode: 'PYG', value: 50, kind: 'coin', position: 1 },
    { currencyCode: 'PYG', value: 100, kind: 'coin', position: 2 },
    { currencyCode: 'PYG', value: 500, kind: 'coin', position: 3 },
    { currencyCode: 'PYG', value: 1000, kind: 'coin', position: 4 },
    { currencyCode: 'PYG', value: 2000, kind: 'bill', position: 5 },
    { currencyCode: 'PYG', value: 5000, kind: 'bill', position: 6 },
    { currencyCode: 'PYG', value: 10000, kind: 'bill', position: 7 },
    { currencyCode: 'PYG', value: 20000, kind: 'bill', position: 8 },
    { currencyCode: 'PYG', value: 50000, kind: 'bill', position: 9 },
    { currencyCode: 'PYG', value: 100000, kind: 'bill', position: 10 },
    // USD (centavos: value=100 → $1.00)
    { currencyCode: 'USD', value: 1, kind: 'coin', position: 1 },
    { currencyCode: 'USD', value: 5, kind: 'coin', position: 2 },
    { currencyCode: 'USD', value: 10, kind: 'coin', position: 3 },
    { currencyCode: 'USD', value: 25, kind: 'coin', position: 4 },
    { currencyCode: 'USD', value: 50, kind: 'coin', position: 5 },
    { currencyCode: 'USD', value: 100, kind: 'coin', position: 6 },
    { currencyCode: 'USD', value: 100, kind: 'bill', position: 7 },
    { currencyCode: 'USD', value: 500, kind: 'bill', position: 8 },
    { currencyCode: 'USD', value: 1000, kind: 'bill', position: 9 },
    { currencyCode: 'USD', value: 2000, kind: 'bill', position: 10 },
    { currencyCode: 'USD', value: 5000, kind: 'bill', position: 11 },
    { currencyCode: 'USD', value: 10000, kind: 'bill', position: 12 },
    // BRL (centavos)
    { currencyCode: 'BRL', value: 5, kind: 'coin', position: 1 },
    { currencyCode: 'BRL', value: 10, kind: 'coin', position: 2 },
    { currencyCode: 'BRL', value: 25, kind: 'coin', position: 3 },
    { currencyCode: 'BRL', value: 50, kind: 'coin', position: 4 },
    { currencyCode: 'BRL', value: 100, kind: 'coin', position: 5 },
    { currencyCode: 'BRL', value: 200, kind: 'bill', position: 6 },
    { currencyCode: 'BRL', value: 500, kind: 'bill', position: 7 },
    { currencyCode: 'BRL', value: 1000, kind: 'bill', position: 8 },
    { currencyCode: 'BRL', value: 2000, kind: 'bill', position: 9 },
    { currencyCode: 'BRL', value: 5000, kind: 'bill', position: 10 },
    { currencyCode: 'BRL', value: 10000, kind: 'bill', position: 11 },
    { currencyCode: 'BRL', value: 20000, kind: 'bill', position: 12 },
  ];

  for (const d of DENOMINATIONS) {
    const [existing] = await db
      .select()
      .from(denomination)
      .where(
        and(
          eq(denomination.currencyCode, d.currencyCode),
          eq(denomination.value, d.value),
          eq(denomination.kind, d.kind)
        )
      )
      .limit(1);
    if (existing) continue;
    await db.insert(denomination).values(d);
  }
  console.log('Denominations sembradas (PYG/USD/BRL)');

  // 5. tenant_currency para demo: PYG primary + USD/BRL activos
  const TENANT_CURRENCIES = [
    { currencyCode: 'PYG', isPrimary: true, position: 1 },
    { currencyCode: 'USD', isPrimary: false, position: 2 },
    { currencyCode: 'BRL', isPrimary: false, position: 3 },
  ];

  for (const tc of TENANT_CURRENCIES) {
    const [existing] = await db
      .select()
      .from(tenantCurrency)
      .where(
        and(
          eq(tenantCurrency.tenantId, demoTenantId),
          eq(tenantCurrency.currencyCode, tc.currencyCode)
        )
      )
      .limit(1);
    if (existing) continue;
    await db.insert(tenantCurrency).values({ tenantId: demoTenantId, ...tc });
  }
  console.log('tenant_currency configurado para demo: PYG primary + USD/BRL activos');

  // 6. exchange_rate inicial dummy (PYG primary; secundarias expresadas en PYG por 1 unidad)
  const INITIAL_RATES = [
    { currencyCode: 'USD', buyRate: '7300', sellRate: '7350' },
    { currencyCode: 'BRL', buyRate: '1280', sellRate: '1320' },
  ];

  for (const r of INITIAL_RATES) {
    const [existing] = await db
      .select()
      .from(exchangeRate)
      .where(
        and(
          eq(exchangeRate.tenantId, demoTenantId),
          eq(exchangeRate.currencyCode, r.currencyCode)
        )
      )
      .limit(1);
    if (existing) continue;
    await db.insert(exchangeRate).values({
      tenantId: demoTenantId,
      currencyCode: r.currencyCode,
      buyRate: r.buyRate,
      sellRate: r.sellRate,
      setBy: superUserId,
      note: 'seed inicial',
    });
  }
  console.log('exchange_rate inicial sembrado');

  console.log('Seed completado.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
