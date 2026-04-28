import { Args, Query, Resolver } from '@nestjs/graphql';
import { Injectable } from '@nestjs/common';
import {
  Ctx,
  PluginCommonModule,
  RequestContext,
  Asset,
  VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';

interface TenantCustomFields {
  slogan?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoAsset?: Asset;
}

@Injectable()
class ThemeService {
  async getActiveTheme(ctx: RequestContext) {
    const channel = ctx.channel;
    const cf = (channel.customFields ?? {}) as TenantCustomFields;
    return {
      channelToken: channel.token,
      name: channel.code,
      slogan: cf.slogan ?? null,
      logoUrl: cf.logoAsset?.preview ?? cf.logoAsset?.source ?? null,
      primaryColor: cf.primaryColor ?? '#1f2937',
      secondaryColor: cf.secondaryColor ?? '#6b7280',
      accentColor: cf.accentColor ?? '#3b82f6',
    };
  }
}

@Resolver()
class ThemeShopResolver {
  constructor(private service: ThemeService) {}

  @Query()
  activeChannelTheme(@Ctx() ctx: RequestContext) {
    return this.service.getActiveTheme(ctx);
  }
}

const schema = gql`
  type ChannelTheme {
    channelToken: String!
    name: String!
    slogan: String
    logoUrl: String
    primaryColor: String!
    secondaryColor: String!
    accentColor: String!
  }

  extend type Query {
    activeChannelTheme: ChannelTheme!
  }
`;

/**
 * theme-manager — Expone configuración visual del Channel activo al storefront.
 *
 * Doc: docs/plugins/theme-manager.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [ThemeService],
  shopApiExtensions: {
    schema,
    resolvers: [ThemeShopResolver],
  },
  adminApiExtensions: {
    schema,
    resolvers: [ThemeShopResolver],
  },
})
export class ThemeManagerPlugin {}
