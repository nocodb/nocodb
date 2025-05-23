/**
 * Centralized configuration for GitHub Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_GITHUB_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_GITHUB_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_GITHUB_REDIRECT_URI;

// OAuth scopes
export const scopes = ['read:user', 'repo'];

// OAuth URIs
export const authUri =
  clientId && redirectUri
    ? `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://github.com/login/oauth/access_token';
