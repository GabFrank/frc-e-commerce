import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { CurrencyRate } from '../entities/currency-rate.entity';
import { CurrencyRateService } from '../services/currency-rate.service';

@Resolver()
export class CurrencyRateAdminResolver {
  constructor(private service: CurrencyRateService) {}

  @Query()
  @Allow(Permission.Authenticated)
  currencyRates(@Ctx() ctx: RequestContext): Promise<CurrencyRate[]> {
    return this.service.list(ctx);
  }

  @Mutation()
  @Allow(Permission.SuperAdmin)
  createCurrencyRate(
    @Ctx() ctx: RequestContext,
    @Args('input') input: any,
  ): Promise<CurrencyRate> {
    return this.service.create(ctx, input);
  }
}

@Resolver()
export class CurrencyRateShopResolver {
  constructor(private service: CurrencyRateService) {}

  @Query()
  currencyRates(@Ctx() ctx: RequestContext): Promise<CurrencyRate[]> {
    return this.service.list(ctx);
  }
}
