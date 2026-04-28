import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * payment-bancard — Stub. Integración Bancard VPOS Paraguay.
 *
 * Doc: docs/plugins/payment-bancard.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
})
export class PaymentBancardPlugin {}
