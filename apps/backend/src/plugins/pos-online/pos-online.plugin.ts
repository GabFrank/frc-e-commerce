import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * pos-online — Punto de venta web con lector de códigos USB-HID.
 *
 * Estado: stub. Implementación pendiente — ver docs/plugins/pos-online.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
})
export class PosOnlinePlugin {}
