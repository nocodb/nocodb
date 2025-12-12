# Box Auth Integration

Authentication integration for Box API in NocoDB. The package extends the `AuthIntegration` base class and provides an authenticated HTTP client for Box API v2.

## Features

- **OAuth2 Authentication**: Full OAuth2 support with authorization code flow and token refresh
- **API Client**: Built-in HTTP client for Box API v2 (using `axios` under the hood)
- **Rate Limiting**: Built-in rate limit handling (200 requests per minute per user)
- **Secure Storage**: Credentials are stored securely via NocoDB integrations framework
- **Connection Testing**: Built-in connection test to verify authentication

## How It Works

1. Uses OAuth2 authorization code flow for authentication
2. Implements refresh token support for long-lived access
3. Returns a pre-configured `AxiosInstance` with base URL `https://api.box.com/2.0` and Bearer token authentication
4. All requests are rate-limited to 200 requests per minute per user
5. The authenticated client can be used by other integrations (e.g., Box Sync) to make API calls
6. OAuth tokens are automatically refreshed when expired using the stored refresh token

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled
- Box Developer Console app with OAuth credentials configured (see SETUP.md)

### Auth Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this auth connection |
| `config.type` | Authentication type: `OAuth` |
| `config.oauth` | OAuth configuration field (required). After OAuth flow completion, the framework stores tokens in `config.oauth_token`, `config.refresh_token`, and `config.expires_in` |

### Required Box Permissions

Grant the OAuth token the ability to:

- `root_readonly` – read-only access to files and folders

For OAuth setup instructions, see [SETUP.md](./SETUP.md).

## Authentication

To authenticate using Box OAuth2:

1. Ensure OAuth credentials are configured (see SETUP.md)
2. Click the "Connect to Box" button in the NocoDB Box Auth integration configuration
3. You will be redirected to Box to authorize the application
4. Grant the requested permissions
5. You will be redirected back to NocoDB with the authentication completed

## API Endpoints Used

- `GET /users/me` – used for connection testing (retrieves user information)
- `POST /oauth2/token` – OAuth token exchange and refresh

## Rate Limiting

- Box allows 200 requests per minute per user
- The integration automatically handles rate limiting with a queue size of 100 requests
- Requests exceeding the limit are queued and processed when capacity is available

## Error Handling & Limits

- Missing or invalid OAuth token throws an error with a clear message
- Expired OAuth tokens are automatically refreshed using the stored refresh token via the `refreshToken()` method
- Token expiration is tracked via the `expires_in` field (in seconds) stored in the configuration
- Permission errors for specific API endpoints surface the original Box API error
- Network or API request failures are propagated with error details
- Connection test validates authentication by calling `/users/me` endpoint and returns success/failure status

## Usage Example

```typescript
import { Integration } from '@noco-integrations/core';

const authIntegration = await Integration.get(context, authIntegrationId);
const authWrapper = await authIntegration.getIntegrationWrapper();
const boxAuth = await authWrapper.authenticate(); // Returns AxiosInstance

// Get user information
const { data: user } = await boxAuth.get('/users/me');

// List folder items
const { data: items } = await boxAuth.get('/folders/0/items', {
  params: {
    limit: 100,
    fields: 'id,type,name,size',
  },
});

// Get file metadata
const { data: file } = await boxAuth.get(`/files/${fileId}`, {
  params: {
    fields: 'id,name,size,modified_at',
  },
});
```

## Box API Documentation

- [Box API Overview](https://developer.box.com/guides/api-calls/)
- [Box OAuth Guide](https://developer.box.com/guides/authentication/oauth2/)

## Security

- OAuth tokens are never exposed to the frontend
- Credentials are stored and managed by NocoDB's secure integrations framework
- All requests to Box are made over HTTPS
- OAuth tokens support refresh token rotation for enhanced security

## Next Steps

- Pair this integration with Box Sync integration to sync files and folders
- Use the authenticated client in custom automations or workflows
- Monitor rate limit usage for large-scale operations
