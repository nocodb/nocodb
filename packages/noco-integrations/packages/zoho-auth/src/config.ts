/**
 * Centralized configuration for Zoho Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_ZOHO_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_ZOHO_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_ZOHO_REDIRECT_URI;

// OAuth scopes - Zoho Projects API scopes
// https://www.zoho.com/projects/help/rest-api/oauth-steps.html
export const scopes = [
  'ZohoProjects.projects.ALL',
  'ZohoProjects.portals.ALL',
  'ZohoProjects.tasks.ALL',
  'ZohoProjects.users.ALL',
];

// OAuth auth URI template - {{config.region}} will be replaced at runtime
export const authUri =
  clientId && redirectUri
    ? `https://accounts.zoho.{{config.region}}/oauth/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(',')}&response_type=code&access_type=offline&prompt=consent`
    : '';

// OAuth token URI - dynamic based on region
export const getTokenUri = (region: string): string => {
  return `https://accounts.zoho.${region}/oauth/v2/token`;
};

// Helper to get API base URL
export const getApiBaseUrl = (region: string): string => {
  return `https://projectsapi.zoho.${region}/restapi`;
};
