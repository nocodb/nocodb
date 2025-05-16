/**
 * Centralized configuration for Linear Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_LINEAR_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_LINEAR_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_LINEAR_REDIRECT_URI;

// OAuth scopes - Linear scopes from https://developers.linear.app/docs/oauth/authentication-flow
export const scopes = ['read', 'write'];

// OAuth URIs for Linear
export const authUri =
  clientId && redirectUri
    ? `https://linear.app/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&response_type=code&prompt=consent`
    : '';

export const tokenUri = 'https://api.linear.app/oauth/token'; 