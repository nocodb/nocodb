/**
 * Centralized configuration for GitLab Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_GITLAB_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_GITLAB_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_GITLAB_REDIRECT_URI;

// OAuth scopes
export const scopes = ['api', 'read_user'];

// OAuth URIs
export const authUri =
  clientId && redirectUri
    ? `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://gitlab.com/oauth/token'; 