import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * cuentas-corrientes — Stub. Plugin grande, post-MVP.
 *
 * Doc: docs/plugins/cuentas-corrientes.md
 */
@VendurePlugin({
  imports: [PluginCommonModule],
})
export class CuentasCorrientesPlugin {}
