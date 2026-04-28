import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyCode, RequestContext, TransactionalConnection } from '@vendure/core';
import { Repository } from 'typeorm';
import { CurrencyRate } from '../entities/currency-rate.entity';

@Injectable()
export class CurrencyRateService {
  constructor(private connection: TransactionalConnection) {}

  async list(ctx: RequestContext): Promise<CurrencyRate[]> {
    return this.connection.getRepository(ctx, CurrencyRate).find({
      order: { effectiveAt: 'DESC' },
    });
  }

  async create(
    ctx: RequestContext,
    input: {
      fromCurrency: CurrencyCode;
      toCurrency: CurrencyCode;
      rate: number;
      effectiveAt?: Date;
      channelId?: string;
    },
  ): Promise<CurrencyRate> {
    const repo = this.connection.getRepository(ctx, CurrencyRate);
    const entity = repo.create({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      rate: input.rate,
      effectiveAt: input.effectiveAt ?? new Date(),
      channelId: input.channelId,
    });
    return repo.save(entity);
  }

  async convert(
    ctx: RequestContext,
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode,
  ): Promise<number> {
    if (from === to) return amount;
    const repo = this.connection.getRepository(ctx, CurrencyRate);
    const direct = await repo.findOne({
      where: { fromCurrency: from, toCurrency: to },
      order: { effectiveAt: 'DESC' },
    });
    if (direct) return amount * Number(direct.rate);
    const inverse = await repo.findOne({
      where: { fromCurrency: to, toCurrency: from },
      order: { effectiveAt: 'DESC' },
    });
    if (inverse && Number(inverse.rate) !== 0) return amount / Number(inverse.rate);
    throw new Error(`No currency rate available for ${from} -> ${to}`);
  }
}
