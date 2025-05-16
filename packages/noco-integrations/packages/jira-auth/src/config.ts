/**
 * Centralized configuration for Jira Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_JIRA_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_JIRA_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_JIRA_REDIRECT_URI;

// OAuth scopes (Jira scopes reference: https://developer.atlassian.com/cloud/jira/platform/oauth-2-authorization-code-grants-3lo-for-apps/#using-oauth-2-0--3lo-)
export const scopes = ['read:jira-user', 'read:jira-work', 'write:jira-work'];

// OAuth URIs for Atlassian (Jira)
export const authUri =
  clientId && redirectUri
    ? `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${clientId}&scope=${encodeURIComponent(scopes.join(' '))}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&prompt=consent`
    : '';

export const tokenUri = 'https://auth.atlassian.com/oauth/token';
