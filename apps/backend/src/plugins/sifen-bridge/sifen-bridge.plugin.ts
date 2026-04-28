import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * sifen-bridge — Stub. Cuando se requiera factura electrónica SIFEN, este
 * plugin consume frc-efact API (proyecto separado, no se reimplementa SIFEN).
 *
 * Doc: docs/plugins/sifen-bridge.md
 *
 * Variables de entorno requeridas (cuando se active):
 *   - FRC_EFACT_API_URL
 *   - FRC_EFACT_API_KEY
 */
@VendurePlugin({
  imports: [PluginCommonModule],
})
export class SifenBridgePlugin {}
