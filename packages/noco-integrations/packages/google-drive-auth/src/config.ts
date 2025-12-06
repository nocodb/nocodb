/**
 * Centralized configuration for Google Drive Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_GOOGLEDRIVE_CLIENT_ID;
export const clientSecret =
  process.env.INTEGRATION_AUTH_GOOGLEDRIVE_CLIENT_SECRET;
export const redirectUri =
  process.env.INTEGRATION_AUTH_GOOGLEDRIVE_REDIRECT_URI;

// OAuth scopes for Google Drive
// See: https://developers.google.com/drive/api/guides/about-auth
export const scopes = ['https://www.googleapis.com/auth/drive.readonly'];

// OAuth URIs for Google Drive
export const authUri =
  clientId && redirectUri
    ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&access_type=offline&prompt=consent`
    : '';

export const tokenUri = 'https://oauth2.googleapis.com/token';
