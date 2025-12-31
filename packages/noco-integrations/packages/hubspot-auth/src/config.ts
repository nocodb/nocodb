/**
 * Centralized configuration for Hubspot Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_HUBSPOT_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_HUBSPOT_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_HUBSPOT_REDIRECT_URI;

// OAuth scopes for Hubspot
// See: https://developers.hubspot.com/docs/apps/legacy-apps/authentication/scopes
export const scopes = [
  'oauth',
  'crm.objects.companies.read',
  'crm.objects.contacts.read',
  'crm.objects.owners.read',
];

// OAuth URIs for Hubspot
export const authUri =
  clientId && redirectUri
    ? `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes.join(' '))}&response_type=code`
    : '';

export const tokenUri = 'https://api.hubapi.com/oauth/v1/token';
