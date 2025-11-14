# Bitbucket Auth Integration

Authentication integration for Bitbucket Cloud API in NocoDB.

## Features

- **OAuth 2.0 Authentication**: Full OAuth 2.0 support with authorization code flow
- **Access Token Authentication**: Direct access token authentication for simpler use cases
- **Token Refresh**: Automatic token refresh handling for OAuth tokens
- **API Client**: Built-in HTTP client for Bitbucket Cloud REST API v2.0

## Authentication Methods

### 1. Access Token (API Key)

Use a Bitbucket App Password or Repository Access Token:

1. Go to Bitbucket Settings → App passwords
2. Create a new app password with required permissions
3. Use the generated token in the integration

### 2. OAuth 2.0

Full OAuth 2.0 authorization code flow with PKCE support:

1. Configure OAuth consumer in Bitbucket
2. Set up redirect URI in NocoDB integration settings
3. Users authorize access through Bitbucket's OAuth flow
4. Tokens are automatically refreshed when expired

## Configuration

### Environment Variables

Required for OAuth 2.0:

```bash
INTEGRATION_AUTH_BITBUCKET_CLIENT_ID=your_client_id
INTEGRATION_AUTH_BITBUCKET_CLIENT_SECRET=your_client_secret
INTEGRATION_AUTH_BITBUCKET_REDIRECT_URI=https://your-nocodb-instance/api/v2/integrations/oauth/callback
```

## OAuth Scopes

Default scopes requested:
- `repository` - Read access to repositories
- `repository:write` - Write access to repositories
- `pullrequest` - Read access to pull requests
- `pullrequest:write` - Write access to pull requests
- `issue` - Read access to issues
- `issue:write` - Write access to issues
- `account` - Read access to account information

## API Client Usage

The integration returns a configured axios instance for Bitbucket API:

```typescript
const axiosInstance = await integration.authenticate();

// Get current user
const { data: user } = await axiosInstance.get('/user');

// List repositories
const { data: repos } = await axiosInstance.get('/repositories/workspace-id');

// Create a pull request
const { data: pr } = await axiosInstance.post('/repositories/workspace-id/repo-slug/pullrequests', {
  title: 'New PR',
  source: { branch: { name: 'feature' } },
  destination: { branch: { name: 'main' } }
});

// The axios instance is pre-configured with:
// - Base URL: https://api.bitbucket.org/2.0
// - Authorization header with Bearer token
// - Accept and Content-Type headers
```

## Bitbucket API Documentation

- [Bitbucket Cloud REST API](https://developer.atlassian.com/cloud/bitbucket/rest/intro/)
- [OAuth 2.0 Authentication](https://developer.atlassian.com/cloud/bitbucket/rest/intro/#authentication)
- [API Reference](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/)

## Token Refresh

OAuth tokens are automatically refreshed when they expire. The integration handles:
- Token expiration detection
- Automatic refresh token exchange
- Updated token storage via callback

## Error Handling

The integration provides detailed error messages for:
- Authentication failures
- Token expiration
- API request errors
- Network issues

## Security

- Client credentials are never exposed to the frontend
- OAuth tokens are securely stored and encrypted
- Refresh tokens enable long-term access without re-authorization
- HTTPS is enforced for all API communications
