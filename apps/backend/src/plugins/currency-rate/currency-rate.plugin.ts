import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import {
  CurrencyRateAdminResolver,
  CurrencyRateShopResolver,
} from './api/currency-rate.resolver';
import { adminSchema, shopSchema } from './api/schema';
import { CurrencyRate } from './entities/currency-rate.entity';
import { CurrencyRateService } from './services/currency-rate.service';

/**
 * currency-rate — Tasas de cambio entre monedas. Servicio de conversión usado
 * en presentación storefront. No persiste Order en moneda alternativa.
 *
 * Doc: docs/plugins/currency-rate.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [CurrencyRate],
  providers: [CurrencyRateService],
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [CurrencyRateAdminResolver],
  },
  shopApiExtensions: {
    schema: shopSchema,
    resolvers: [CurrencyRateShopResolver],
  },
})
export class CurrencyRatePlugin {}
