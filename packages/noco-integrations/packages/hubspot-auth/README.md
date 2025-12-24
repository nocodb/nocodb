# HubSpot Auth Integration

Authentication integration for HubSpot API in NocoDB. This package extends the `AuthIntegration` base class and provides an authenticated HTTP client for HubSpot's API.

## Features

- **OAuth2 Authentication**: Full OAuth2 support with authorization code flow and token refresh
- **API Client**: Built-in HTTP client for HubSpot API (using `axios` under the hood)
- **Rate Limiting**: Built-in rate limit handling for HubSpot API (100 requests per 10 seconds by default)
- **Secure Storage**: Credentials are stored securely via NocoDB integrations framework
- **Connection Testing**: Built-in connection test to verify authentication

## How It Works

1. Implements OAuth2 authorization code flow with PKCE support
2. Returns a pre-configured `AxiosInstance` with base URL `https://api.hubapi.com` and Bearer token authentication
3. Automatically handles token refresh when access tokens expire
4. The authenticated client can be used by other integrations to make API calls to HubSpot

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled
- HubSpot Developer Account
- A HubSpot App with OAuth credentials

### Auth Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this auth connection |
| `config.clientId` | HubSpot Client ID |
| `config.clientSecret` | HubSpot Client Secret |
| `config.redirectUri` | OAuth redirect URI (must match the one in your HubSpot app settings) |

### Required Scopes

The following OAuth scopes are required for basic functionality:

- `crm.objects.companies.read` - Read access to companies
- `crm.objects.contacts.read` - Read access to contacts
- `crm.objects.owners.read` - Read access to owners

## Authentication Flow

### OAuth2 Authentication

To authenticate with HubSpot:

1. Configure your HubSpot app in the [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Add the following redirect URIs to your app's auth settings:
   - `http://localhost:3000/api/v1/db/auth/integrations/hubspot/callback` (development)
   - `[YOUR_NOCODB_URL]/api/v1/db/auth/integrations/hubspot/callback` (production)
3. In NocoDB, navigate to Integrations > HubSpot Auth
4. Enter your Client ID, Client Secret, and Redirect URI
5. Click "Connect to HubSpot"
6. You'll be redirected to HubSpot to authorize the application
7. Grant the requested permissions
8. You'll be redirected back to NocoDB with the authentication completed

## Rate Limiting

- HubSpot has a default rate limit of 100 requests per 10 seconds
- The integration includes automatic retry logic for rate-limited requests
- Consider implementing client-side rate limiting for high-volume applications
