/**
 * Centralized configuration for Asana Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_ASANA_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_ASANA_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_ASANA_REDIRECT_URI;

// OAuth scopes - Asana scopes reference: https://developers.asana.com/docs/authentication
export const scopes = ['default'];

// OAuth URIs for Asana
export const authUri =
  clientId && redirectUri
    ? `https://app.asana.com/-/oauth_authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://app.asana.com/-/oauth_token'; 