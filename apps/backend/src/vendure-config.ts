import {
  dummyPaymentHandler,
  DefaultJobQueuePlugin,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  VendureConfig,
  LanguageCode,
} from '@vendure/core';
import {
  defaultEmailHandlers,
  EmailPlugin,
  FileBasedTemplateLoader,
} from '@vendure/email-plugin';
import { AssetServerPlugin, configureS3AssetStorage } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import 'dotenv/config';
import path from 'path';
import { TenantManagementPlugin } from './plugins/tenant-management';
import { CurrencyRatePlugin } from './plugins/currency-rate';
import { ThemeManagerPlugin } from './plugins/theme-manager';
import { PosOnlinePlugin } from './plugins/pos-online';
import { ComprasPlugin } from './plugins/compras';
import { CajaPlugin } from './plugins/caja';
import { FinanzasPlugin } from './plugins/finanzas';
import { CuentasCorrientesPlugin } from './plugins/cuentas-corrientes';
import { PaymentTransferenciaPlugin } from './plugins/payment-transferencia';
import { PaymentContraentregaPlugin } from './plugins/payment-contraentrega';
import { PaymentBancardPlugin } from './plugins/payment-bancard';
import { PaymentUpayPlugin } from './plugins/payment-upay';
import { SifenBridgePlugin } from './plugins/sifen-bridge';

const IS_DEV = process.env.APP_ENV === 'dev';
const serverPort = +(process.env.PORT ?? 3000);

const usePostgres = !!process.env.DATABASE_URL;
const useR2 = !!process.env.R2_BUCKET && !!process.env.R2_ACCOUNT_ID;

export const config: VendureConfig = {
  apiOptions: {
    port: serverPort,
    adminApiPath: 'admin-api',
    shopApiPath: 'shop-api',
    trustProxy: IS_DEV ? false : 1,
    ...(IS_DEV
      ? {
          adminApiDebug: true,
          shopApiDebug: true,
        }
      : {}),
    cors: {
      origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
        .split(',')
        .map((s) => s.trim()),
      credentials: true,
    },
  },
  authOptions: {
    tokenMethod: ['bearer', 'cookie'],
    superadminCredentials: {
      identifier: process.env.SUPERADMIN_USERNAME ?? 'superadmin',
      password: process.env.SUPERADMIN_PASSWORD ?? 'superadmin',
    },
    cookieOptions: {
      secret: process.env.COOKIE_SECRET ?? 'dev-cookie-secret-change-me',
    },
  },
  dbConnectionOptions: usePostgres
    ? {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        synchronize: false,
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: false,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {
        type: 'better-sqlite3',
        synchronize: true,
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: false,
        database: path.join(__dirname, '../vendure.sqlite'),
      },
  defaultLanguageCode: LanguageCode.es,
  paymentOptions: {
    paymentMethodHandlers: [dummyPaymentHandler],
  },
  customFields: {},
  plugins: [
    GraphiqlPlugin.init(),
    AssetServerPlugin.init({
      route: 'assets',
      assetUploadDir: path.join(__dirname, '../static/assets'),
      ...(process.env.ASSET_URL_PREFIX
        ? { assetUrlPrefix: process.env.ASSET_URL_PREFIX }
        : {}),
      ...(useR2
        ? {
            storageStrategyFactory: configureS3AssetStorage({
              bucket: process.env.R2_BUCKET!,
              credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
              },
              nativeS3Configuration: {
                endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                forcePathStyle: true,
                region: 'auto',
              },
            }),
          }
        : {}),
    }),
    DefaultSchedulerPlugin.init(),
    DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
    DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
    EmailPlugin.init({
      devMode: true,
      outputPath: path.join(__dirname, '../static/email/test-emails'),
      route: 'mailbox',
      handlers: defaultEmailHandlers,
      templateLoader: new FileBasedTemplateLoader(
        path.join(__dirname, '../static/email/templates'),
      ),
      globalTemplateVars: {
        fromAddress: process.env.EMAIL_FROM ?? '"frc-e-commerce" <noreply@frc-e-commerce.com>',
        verifyEmailAddressUrl: `${process.env.STOREFRONT_URL ?? 'http://localhost:3001'}/verify`,
        passwordResetUrl: `${process.env.STOREFRONT_URL ?? 'http://localhost:3001'}/password-reset`,
        changeEmailAddressUrl: `${process.env.STOREFRONT_URL ?? 'http://localhost:3001'}/verify-email-address-change`,
      },
    }),
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: IS_DEV
        ? path.join(__dirname, '../dist/dashboard')
        : path.join(__dirname, 'dashboard'),
    }),
    TenantManagementPlugin,
    CurrencyRatePlugin,
    ThemeManagerPlugin,
    PosOnlinePlugin,
    ComprasPlugin,
    CajaPlugin,
    FinanzasPlugin,
    CuentasCorrientesPlugin,
    PaymentTransferenciaPlugin,
    PaymentContraentregaPlugin,
    PaymentBancardPlugin,
    PaymentUpayPlugin,
    SifenBridgePlugin,
  ],
};
