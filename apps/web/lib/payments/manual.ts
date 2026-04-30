import type { PaymentHandler, PaymentResult, PaymentContext } from './handler.interface';

export const transferenciaHandler: PaymentHandler = {
  code: 'transferencia',
  label: 'Transferencia bancaria',
  async createPayment(_ctx: PaymentContext): Promise<PaymentResult> {
    return {
      status: 'pending',
      metadata: {
        instructions: 'Transferencia bancaria — admin confirma manualmente',
      },
    };
  },
};

export const contraentregaHandler: PaymentHandler = {
  code: 'contraentrega',
  label: 'Pago contra entrega',
  async createPayment(_ctx: PaymentContext): Promise<PaymentResult> {
    return {
      status: 'pending',
      metadata: {
        instructions: 'El pago se realiza al momento de la entrega',
      },
    };
  },
};

export const efectivoHandler: PaymentHandler = {
  code: 'efectivo',
  label: 'Efectivo en tienda',
  async createPayment(_ctx: PaymentContext): Promise<PaymentResult> {
    return {
      status: 'pending',
      metadata: {
        instructions: 'El cliente paga en efectivo al retirar el pedido',
      },
    };
  },
};
