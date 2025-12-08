/**
 * Centralized configuration for Box Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_BOX_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_BOX_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_BOX_REDIRECT_URI;

// OAuth scopes for Box
// See: https://developer.box.com/guides/api-calls/permissions-and-errors/scopes/
export const scopes = ['root_readonly'];

// OAuth URIs for Box
export const authUri =
  clientId && redirectUri
    ? `https://account.box.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://api.box.com/oauth2/token';
