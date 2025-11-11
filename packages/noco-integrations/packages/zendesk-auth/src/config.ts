/**
 * Centralized configuration for Zendesk Auth Integration
 */

// Environment variables for Zendesk OAuth
export const clientId = process.env.INTEGRATION_AUTH_ZENDESK_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_ZENDESK_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_ZENDESK_REDIRECT_URI;

// OAuth scopes - Zendesk scopes: read, write, impersonate, or resource-specific
// Examples: "read", "read write", "tickets:read", "users:read users:write"
export const scopes = ['read', 'write'];

// OAuth auth URI template - {{config.subdomain}} will be replaced at runtime
export const authUri =
  clientId && redirectUri
    ? `https://{{config.subdomain}}.zendesk.com/oauth/authorizations/new?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(' ')}`
    : '';

// OAuth URIs for Zendesk Support
export const getTokenUri = (sub: string): string => {
  return `https://${sub}.zendesk.com/oauth/tokens`;
};

// Helper to get API base URL
export const getApiBaseUrl = (sub: string): string => {
  return `https://${sub}.zendesk.com/api/v2`;
};