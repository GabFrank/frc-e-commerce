import {
  CreatePaymentResult,
  LanguageCode,
  PaymentMethodHandler,
  PluginCommonModule,
  SettlePaymentResult,
  VendurePlugin,
} from '@vendure/core';

export const transferenciaPaymentHandler = new PaymentMethodHandler({
  code: 'transferencia',
  description: [{ languageCode: LanguageCode.es, value: 'Transferencia bancaria' }],
  args: {},
  createPayment: async (_ctx, _order, amount, _args, metadata): Promise<CreatePaymentResult> => ({
    amount,
    state: 'Authorized',
    transactionId: metadata?.referenceNumber ?? `TRF-${Date.now()}`,
    metadata,
  }),
  settlePayment: async (): Promise<SettlePaymentResult> => ({ success: true }),
});

/**
 * payment-transferencia — Marca Order como Authorized esperando confirmación
 * manual del vendedor.
 *
 * Doc: docs/plugins/payment-transferencia.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(transferenciaPaymentHandler);
    return config;
  },
})
export class PaymentTransferenciaPlugin {}
