import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Channel,
  ChannelService,
  Ctx,
  Permission,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantService {
  constructor(
    private connection: TransactionalConnection,
    private channelService: ChannelService,
  ) {}

  async findBySubdomain(
    ctx: RequestContext,
    subdomain: string,
  ): Promise<Channel | null> {
    const channels = await this.connection.getRepository(ctx, Channel).find();
    const match = channels.find(
      (c) => (c.customFields as { subdomain?: string } | undefined)?.subdomain === subdomain,
    );
    return match ?? null;
  }

  list(ctx: RequestContext): Promise<Channel[]> {
    return this.connection.getRepository(ctx, Channel).find();
  }
}

@Resolver()
export class TenantAdminResolver {
  constructor(private service: TenantService) {}

  @Query()
  @Allow(Permission.SuperAdmin)
  tenants(@Ctx() ctx: RequestContext): Promise<Channel[]> {
    return this.service.list(ctx);
  }

  @Query()
  @Allow(Permission.Public)
  tenantBySubdomain(
    @Ctx() ctx: RequestContext,
    @Args('subdomain') subdomain: string,
  ): Promise<Channel | null> {
    return this.service.findBySubdomain(ctx, subdomain);
  }
}

@Resolver()
export class TenantShopResolver {
  constructor(private service: TenantService) {}

  @Query()
  tenantBySubdomain(
    @Ctx() ctx: RequestContext,
    @Args('subdomain') subdomain: string,
  ): Promise<Channel | null> {
    return this.service.findBySubdomain(ctx, subdomain);
  }
}
