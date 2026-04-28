import {
  CreatePaymentResult,
  LanguageCode,
  PaymentMethodHandler,
  PluginCommonModule,
  SettlePaymentResult,
  VendurePlugin,
} from '@vendure/core';

export const contraentregaPaymentHandler = new PaymentMethodHandler({
  code: 'contraentrega',
  description: [{ languageCode: LanguageCode.es, value: 'Pago contra entrega' }],
  args: {},
  createPayment: async (_ctx, _order, amount, _args, metadata): Promise<CreatePaymentResult> => ({
    amount,
    state: 'Authorized',
    transactionId: `COD-${Date.now()}`,
    metadata,
  }),
  settlePayment: async (): Promise<SettlePaymentResult> => ({ success: true }),
});

/**
 * payment-contraentrega — Pago contra entrega (efectivo).
 *
 * Doc: docs/plugins/payment-contraentrega.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(contraentregaPaymentHandler);
    return config;
  },
})
export class PaymentContraentregaPlugin {}
