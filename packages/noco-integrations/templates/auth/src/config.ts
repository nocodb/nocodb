/**
 * Centralized configuration for Auth Integration
 * Replace placeholders with your service's configuration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_SERVICE_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_SERVICE_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_SERVICE_REDIRECT_URI;

// OAuth scopes - customize based on your service's available scopes
export const scopes = ['read', 'basic'];

// OAuth URIs - replace with your service's OAuth endpoints
export const authUri =
  clientId && redirectUri
    ? `https://your-service.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes.join(' '))}`
    : '';

export const tokenUri = 'https://your-service.com/oauth/token'; 