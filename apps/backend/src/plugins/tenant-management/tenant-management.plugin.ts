import { Asset, LanguageCode, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { adminSchema, shopSchema } from './api/schema';
import {
  TenantAdminResolver,
  TenantService,
  TenantShopResolver,
} from './api/tenant.resolver';

/**
 * tenant-management — Define custom fields en Channel para soportar multi-tenant
 * (subdominio, branding, plan) + queries para resolver tenant por subdominio.
 *
 * Doc: docs/plugins/tenant-management.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [TenantService],
  adminApiExtensions: {
    schema: adminSchema,
    resolvers: [TenantAdminResolver],
  },
  shopApiExtensions: {
    schema: shopSchema,
    resolvers: [TenantShopResolver],
  },
  configuration: (config) => {
    config.customFields.Channel.push(
      {
        name: 'subdomain',
        type: 'string',
        label: [{ languageCode: LanguageCode.es, value: 'Subdominio' }],
        nullable: true,
        unique: true,
        pattern: '^[a-z0-9-]{3,30}$',
      },
      {
        name: 'slogan',
        type: 'string',
        label: [{ languageCode: LanguageCode.es, value: 'Slogan' }],
        nullable: true,
      },
      {
        name: 'logoAsset',
        type: 'relation',
        entity: Asset,
        label: [{ languageCode: LanguageCode.es, value: 'Logo' }],
        nullable: true,
      },
      {
        name: 'primaryColor',
        type: 'string',
        label: [{ languageCode: LanguageCode.es, value: 'Color primario' }],
        defaultValue: '#1f2937',
      },
      {
        name: 'secondaryColor',
        type: 'string',
        label: [{ languageCode: LanguageCode.es, value: 'Color secundario' }],
        defaultValue: '#6b7280',
      },
      {
        name: 'accentColor',
        type: 'string',
        label: [{ languageCode: LanguageCode.es, value: 'Color de acento' }],
        defaultValue: '#3b82f6',
      },
      {
        name: 'plan',
        type: 'string',
        options: [
          { value: 'free' },
          { value: 'starter' },
          { value: 'pro' },
          { value: 'enterprise' },
        ],
        defaultValue: 'free',
        label: [{ languageCode: LanguageCode.es, value: 'Plan' }],
      },
      {
        name: 'customDomain',
        type: 'string',
        label: [{ languageCode: LanguageCode.es, value: 'Dominio custom' }],
        nullable: true,
      },
    );
    return config;
  },
})
export class TenantManagementPlugin {}
