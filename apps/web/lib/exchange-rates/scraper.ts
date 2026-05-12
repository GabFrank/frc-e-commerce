/**
 * Stub para scraping de cotización del día.
 *
 * TODO: implementar scrapper real siguiendo el patrón de frc-gourmet PR #19
 * (https://github.com/GabFrank/frc-gourmet/pull/19). En ese proyecto se
 * scrapean cotizaciones desde fuentes públicas (BCP, Cambios Chaco, etc.) y
 * se cachean por unas horas. Hasta entonces este stub retorna null y el
 * caller cae al fallback (rate guardado en DB → input manual).
 *
 * Convención: la cotización es siempre la de **venta** (sell), es decir,
 * cuántas unidades de la moneda primary equivalen a 1 unidad de la moneda
 * secundaria desde el punto de vista del comercio que está pagando.
 */
export async function fetchTodayRate(_currencyCode: string): Promise<{
  value: number;
  source: 'scraper';
} | null> {
  // Stub: retorna null, lo que dispara el fallback en getSuggestedExchangeRate.
  return null;
}
