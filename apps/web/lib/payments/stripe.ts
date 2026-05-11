// TODO: implement when stripe SDK installed
// Run: pnpm add stripe --filter @frc-e-commerce/web
import type { PaymentHandler, PaymentContext, PaymentResult } from './handler.interface';

export const stripeHandler: PaymentHandler = {
  code: 'stripe',
  label: 'Tarjeta de crédito / débito (Stripe)',
  async createPayment(_ctx: PaymentContext): Promise<PaymentResult> {
    // TODO: install stripe and implement
    throw new Error('Stripe not yet implemented — install stripe SDK first');
  },
  async capturePayment(_ctx: PaymentContext, _paymentId: string): Promise<PaymentResult> {
    // TODO: install stripe and implement
    throw new Error('Stripe not yet implemented — install stripe SDK first');
  },
  async refundPayment(
    _ctx: PaymentContext,
    _paymentId: string,
    _amount: number
  ): Promise<PaymentResult> {
    // TODO: install stripe and implement
    throw new Error('Stripe not yet implemented — install stripe SDK first');
  },
  async handleWebhook(_rawBody: string, _signature: string) {
    // TODO: install stripe and implement
    throw new Error('Stripe not yet implemented — install stripe SDK first');
  },
};
