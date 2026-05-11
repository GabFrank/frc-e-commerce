import type { Order, Tenant, PaymentStatus } from '@frc-e-commerce/db/schema';

export type { PaymentStatus };

export interface PaymentContext {
  order: Order;
  tenant: Tenant;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  status: PaymentStatus;
  externalId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface WebhookResult {
  handled: boolean;
  orderId?: string;
}

export interface PaymentHandler {
  /** Unique machine-readable code for this payment method (e.g. "transferencia") */
  code: string;
  /** Human-readable label shown to customers (e.g. "Transferencia bancaria") */
  label: string;
  /** Initiates a payment and returns the initial status */
  createPayment(ctx: PaymentContext): Promise<PaymentResult>;
  /** Captures a previously authorized payment (e.g. after admin review) */
  capturePayment?(ctx: PaymentContext, paymentId: string): Promise<PaymentResult>;
  /** Issues a full or partial refund */
  refundPayment?(ctx: PaymentContext, paymentId: string, amount: number): Promise<PaymentResult>;
  /** Processes an incoming webhook from the payment gateway */
  handleWebhook?(rawBody: string, signature: string): Promise<WebhookResult>;
}
