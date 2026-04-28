import type { ChannelTheme } from '@frc-e-commerce/shared-types';
import { vendureRequest } from './vendure-client';

const FALLBACK_THEME: ChannelTheme = {
  channelToken: 'default',
  name: 'frc-e-commerce',
  slogan: null,
  logoUrl: null,
  primaryColor: '#1f2937',
  secondaryColor: '#6b7280',
  accentColor: '#3b82f6',
};

const QUERY = /* GraphQL */ `
  query ActiveChannelTheme {
    activeChannelTheme {
      channelToken
      name
      slogan
      logoUrl
      primaryColor
      secondaryColor
      accentColor
    }
  }
`;

/**
 * Resuelve el tema visual de la tienda activa. Si el backend no está disponible
 * o el plugin theme-manager aún no está cargado, devuelve fallback estático.
 */
export async function fetchActiveTheme(): Promise<ChannelTheme> {
  try {
    const data = await vendureRequest<{ activeChannelTheme: ChannelTheme }>({
      query: QUERY,
    });
    return data.activeChannelTheme;
  } catch (err) {
    console.warn('[storefront] theme-manager unavailable, using fallback:', err);
    return FALLBACK_THEME;
  }
}
