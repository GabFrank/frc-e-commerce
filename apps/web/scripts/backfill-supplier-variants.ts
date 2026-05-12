import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

async function main() {
  const { db } = await import('../lib/db.js');
  const { purchaseOrder, purchaseOrderLine, supplierProductVariant } = await import(
    '@frc-e-commerce/db/schema'
  );
  const { eq, inArray, sql } = await import('drizzle-orm');

  console.log('Backfill supplier_product_variant — iniciando');

  // Tomar todas las POs que hayan tenido movimiento (received / partially_received / cancelled).
  // 'placed' queda fuera: no se materializó el costo realmente.
  const pos = await db
    .select({
      id: purchaseOrder.id,
      tenantId: purchaseOrder.tenantId,
      supplierId: purchaseOrder.supplierId,
      currencyCode: purchaseOrder.currencyCode,
      exchangeRateSnapshot: purchaseOrder.exchangeRateSnapshot,
      placedAt: purchaseOrder.placedAt,
      receivedAt: purchaseOrder.receivedAt,
      createdAt: purchaseOrder.createdAt,
    })
    .from(purchaseOrder)
    .where(inArray(purchaseOrder.status, ['received', 'partially_received', 'cancelled']))
    .orderBy(purchaseOrder.receivedAt, purchaseOrder.placedAt, purchaseOrder.createdAt);

  console.log(`POs candidatas: ${pos.length}`);

  // Por cada PO, leer líneas y procesar
  type Snapshot = {
    tenantId: string;
    supplierId: string;
    variantId: string;
    lastUnitCostInCurrency: number;
    currencyCode: string;
    exchangeRateSnapshot: string | null;
    lastUnitCostInPrimary: number | null;
    lastPurchaseOrderId: string;
    lastReceivedAt: Date | null;
    totalQuantityPurchased: number;
  };

  // (supplierId, variantId) → snapshot más reciente
  const latestByPair = new Map<string, Snapshot>();
  // (supplierId, variantId) → totalQty acumulado
  const totalQtyByPair = new Map<string, number>();

  for (const po of pos) {
    const lines = await db
      .select({
        variantId: purchaseOrderLine.variantId,
        unitCostInCurrency: purchaseOrderLine.unitCostInCurrency,
        landedUnitCostInPrimary: purchaseOrderLine.landedUnitCostInPrimary,
        receivedQuantity: purchaseOrderLine.receivedQuantity,
        quantity: purchaseOrderLine.quantity,
      })
      .from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, po.id));

    for (const l of lines) {
      const key = `${po.supplierId}:${l.variantId}`;
      // totalQty: si recibida usamos receivedQuantity, sino la cantidad pedida.
      const qty = l.receivedQuantity > 0 ? l.receivedQuantity : l.quantity;
      totalQtyByPair.set(key, (totalQtyByPair.get(key) ?? 0) + qty);

      const candidateDate = po.receivedAt ?? po.placedAt ?? po.createdAt;
      const existing = latestByPair.get(key);
      const existingDate = existing?.lastReceivedAt ?? null;
      const isMoreRecent =
        !existing ||
        (candidateDate && existingDate && candidateDate > existingDate) ||
        (candidateDate && !existingDate);
      if (isMoreRecent) {
        latestByPair.set(key, {
          tenantId: po.tenantId,
          supplierId: po.supplierId,
          variantId: l.variantId,
          lastUnitCostInCurrency: Number(l.unitCostInCurrency),
          currencyCode: po.currencyCode,
          exchangeRateSnapshot: po.exchangeRateSnapshot ? String(po.exchangeRateSnapshot) : null,
          lastUnitCostInPrimary:
            l.landedUnitCostInPrimary != null ? Number(l.landedUnitCostInPrimary) : null,
          lastPurchaseOrderId: po.id,
          lastReceivedAt: candidateDate ?? null,
          totalQuantityPurchased: 0, // se setea abajo
        });
      }
    }
  }

  console.log(`Pares (supplier, variant) únicos: ${latestByPair.size}`);

  let upserted = 0;
  for (const snap of latestByPair.values()) {
    const key = `${snap.supplierId}:${snap.variantId}`;
    snap.totalQuantityPurchased = totalQtyByPair.get(key) ?? 0;

    await db
      .insert(supplierProductVariant)
      .values({
        tenantId: snap.tenantId,
        supplierId: snap.supplierId,
        variantId: snap.variantId,
        lastUnitCostInCurrency: snap.lastUnitCostInCurrency,
        currencyCode: snap.currencyCode,
        exchangeRateSnapshot: snap.exchangeRateSnapshot,
        lastUnitCostInPrimary: snap.lastUnitCostInPrimary,
        lastPurchaseOrderId: snap.lastPurchaseOrderId,
        lastReceivedAt: snap.lastReceivedAt,
        totalQuantityPurchased: snap.totalQuantityPurchased,
      })
      .onConflictDoUpdate({
        target: [supplierProductVariant.supplierId, supplierProductVariant.variantId],
        // El backfill sobrescribe TODO con el más reciente — el script es idempotente
        // (correrlo varias veces lleva al mismo estado).
        set: {
          tenantId: snap.tenantId,
          lastUnitCostInCurrency: snap.lastUnitCostInCurrency,
          currencyCode: snap.currencyCode,
          exchangeRateSnapshot: snap.exchangeRateSnapshot,
          lastUnitCostInPrimary: snap.lastUnitCostInPrimary,
          lastPurchaseOrderId: snap.lastPurchaseOrderId,
          lastReceivedAt: snap.lastReceivedAt,
          totalQuantityPurchased: snap.totalQuantityPurchased,
          updatedAt: sql`now()`,
        },
      });
    upserted++;
  }

  console.log(`Backfill completado. Filas upserted: ${upserted}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en backfill:', err);
  process.exit(1);
});
