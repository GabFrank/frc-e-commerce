import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * payment-upay — Stub. Integración UPay Paraguay.
 *
 * Doc: docs/plugins/payment-upay.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
})
export class PaymentUpayPlugin {}
