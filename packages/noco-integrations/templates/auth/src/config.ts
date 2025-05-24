/**
 * Centralized configuration for Provider Auth Integration
 */

// Environment variables (follow naming convention INTEGRATION_AUTH_PROVIDER_*)
export const clientId = process.env.INTEGRATION_AUTH_PROVIDER_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_PROVIDER_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_PROVIDER_REDIRECT_URI;

// OAuth scopes needed for your provider
export const scopes = ['read', 'write'];

// OAuth URIs (customize for your provider)
export const authUri =
  clientId && redirectUri
    ? `https://provider.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://provider.com/oauth/token'; 