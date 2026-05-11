import type { PaymentHandler } from './handler.interface';
import { transferenciaHandler, contraentregaHandler, efectivoHandler } from './manual';
import { stripeHandler } from './stripe';

export * from './handler.interface';

/**
 * Registry of all available payment handlers, keyed by their code.
 * Add new handlers here to make them available in checkout.
 */
export const paymentHandlers: Record<string, PaymentHandler> = {
  [transferenciaHandler.code]: transferenciaHandler,
  [contraentregaHandler.code]: contraentregaHandler,
  [efectivoHandler.code]: efectivoHandler,
  [stripeHandler.code]: stripeHandler,
};

/**
 * Returns the payment handler for the given code.
 * Throws if the code is not registered.
 */
export function getPaymentHandler(code: string): PaymentHandler {
  const handler = paymentHandlers[code];
  if (!handler) {
    throw new Error(
      `Payment handler "${code}" not found. Available: ${Object.keys(paymentHandlers).join(', ')}`
    );
  }
  return handler;
}
