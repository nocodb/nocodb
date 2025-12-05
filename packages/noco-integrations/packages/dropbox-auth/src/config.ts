/**
 * Centralized configuration for Dropbox Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_DROPBOX_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_DROPBOX_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_DROPBOX_REDIRECT_URI;

// OAuth scopes for Dropbox
// See: https://www.dropbox.com/developers/reference/oauth-guide#oauth-2.0-scopes
export const scopes = [
  'files.content.read',
  'files.metadata.read',
  'account_info.read',
];

// OAuth URIs for Dropbox
export const authUri =
  clientId && redirectUri
    ? `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://api.dropbox.com/oauth2/token';
