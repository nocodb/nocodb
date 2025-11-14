/**
 * Centralized configuration for Bitbucket Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_BITBUCKET_CLIENT_ID;
export const clientSecret =
  process.env.INTEGRATION_AUTH_BITBUCKET_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_BITBUCKET_REDIRECT_URI;

// OAuth scopes - Bitbucket scopes from https://developer.atlassian.com/cloud/bitbucket/rest/intro/#authentication
export const scopes = [
  'repository',
  'repository:write',
  'pullrequest',
  'pullrequest:write',
  'issue',
  'issue:write',
  'account',
];

// OAuth URIs for Bitbucket
export const authUri =
  clientId && redirectUri
    ? `https://bitbucket.org/site/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
    : '';

export const tokenUri = 'https://bitbucket.org/site/oauth2/access_token';
