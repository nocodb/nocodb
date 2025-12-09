# Dropbox Auth Integration

Authentication integration for Dropbox API in NocoDB. The package extends the `AuthIntegration` base class and provides an authenticated HTTP client for Dropbox API v2.

## Features

- **Access Token Authentication**: Simple access token based authentication
- **OAuth2 Authentication**: Full OAuth2 support with authorization code flow and token refresh
- **API Client**: Built-in HTTP client for Dropbox API v2 (using `axios` under the hood)
- **Rate Limiting**: Built-in rate limit handling (600 requests per minute per user)
- **Secure Storage**: Credentials are stored securely via NocoDB integrations framework
- **Connection Testing**: Built-in connection test to verify authentication

## How It Works

1. Supports two authentication methods: API Key (access token) and OAuth2
2. For API Key: Uses the provided access token directly to authenticate requests
3. For OAuth2: Implements the authorization code flow with PKCE support
4. Returns a pre-configured `AxiosInstance` with base URL `https://api.dropbox.com/2` and Bearer token authentication
5. All requests are rate-limited to 600 requests per minute per user
6. The authenticated client can be used by other integrations (e.g., Dropbox Sync) to make API calls

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled
- For OAuth2: Dropbox app with OAuth credentials configured (see SETUP.md)

### Auth Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this auth connection |
| `config.type` | Authentication type: `ApiKey` (access token) or `OAuth` |
| `config.token` | Dropbox access token (required for ApiKey type) |
| `config.oauth` | OAuth configuration (required for OAuth type) |

### Required Dropbox Permissions

Grant the OAuth token or API key the ability to:

- `files.content.read` – read file contents
- `files.metadata.read` – read file and folder metadata
- `account_info.read` – read account information

## Authentication Methods

### Access Token

To authenticate using a Dropbox access token:

1. Log in to your Dropbox account
2. Navigate to [Dropbox App Console](https://www.dropbox.com/developers/apps)
3. Create a new app or use an existing one
4. Generate an access token for your app
5. Copy the generated token and use it in the NocoDB Dropbox Auth integration configuration

### OAuth2 Authentication

To authenticate using Dropbox OAuth2:

1. Ensure OAuth credentials are configured (see SETUP.md)
2. Click the "Connect to Dropbox" button in the NocoDB Dropbox Auth integration configuration
3. You will be redirected to Dropbox to authorize the application
4. Grant the requested permissions
5. You will be redirected back to NocoDB with the authentication completed

## API Endpoints Used

- `POST /users/get_current_account` – used for connection testing
- `POST /oauth2/token` – OAuth token exchange and refresh

## Rate Limiting

- Dropbox allows 600 requests per minute per user
- The integration automatically handles rate limiting with a queue size of 100 requests
- Requests exceeding the limit are queued and processed when capacity is available

## Error Handling & Limits

- Invalid or missing access token throws an error with a clear message
- Expired OAuth tokens can be refreshed using the `refreshToken()` method
- Permission errors for specific API endpoints surface the original Dropbox API error
- Network or API request failures are propagated with error details
- Connection test validates authentication by calling `/users/get_current_account`

## Usage Example

```typescript
import { Integration } from '@noco-integrations/core';

const authIntegration = await Integration.get(context, authIntegrationId);
const authWrapper = await authIntegration.getIntegrationWrapper();
const dropboxAuth = await authWrapper.authenticate(); // Returns AxiosInstance

// Get current account info
const { data: account } = await dropboxAuth.post('/users/get_current_account', null);

// List files in a folder
const { data: files } = await dropboxAuth.post('/files/list_folder', {
  path: '/',
});

// Download a file
const { data: file } = await dropboxAuth.post('/files/download', {
  path: '/example.txt',
});
```

## Dropbox API Documentation

- [Dropbox API Overview](https://www.dropbox.com/developers/documentation/http/overview)
- [Dropbox OAuth Guide](https://www.dropbox.com/developers/reference/oauth-guide)

## Security

- Access tokens are never exposed to the frontend
- Credentials are stored and managed by NocoDB's secure integrations framework
- All requests to Dropbox are made over HTTPS
- OAuth tokens support refresh token rotation for enhanced security

## Next Steps

- Pair this integration with Dropbox Sync integration to sync files and folders
- Use the authenticated client in custom automations or workflows
- Monitor rate limit usage for large-scale operations
