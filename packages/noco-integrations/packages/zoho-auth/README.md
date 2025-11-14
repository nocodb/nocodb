# Zoho Auth Integration

OAuth 2.0 authentication integration for Zoho Projects API in NocoDB.

## Features

- **OAuth 2.0 Authentication**: Secure OAuth flow with PKCE support
- **API Key Authentication**: Alternative authentication using Zoho API tokens
- **Token Refresh**: Automatic token refresh handling
- **Multi-region Support**: Supports all Zoho data centers (.com, .eu, .in, .com.au, .jp, .com.cn)

## Configuration

### Environment Variables

Set the following environment variables for OAuth authentication:

```bash
INTEGRATION_AUTH_ZOHO_CLIENT_ID=your_client_id
INTEGRATION_AUTH_ZOHO_CLIENT_SECRET=your_client_secret
INTEGRATION_AUTH_ZOHO_REDIRECT_URI=https://your-app.com/oauth/callback
```

### Data Centers / Regions

Zoho operates in multiple regions. You can select your region in the integration form:

- `com` - United States (default)
- `eu` - Europe
- `in` - India
- `com.au` - Australia
- `jp` - Japan
- `com.cn` - China


## OAuth Setup

1. **Create OAuth Client**:
   - Go to [Zoho API Console](https://api-console.zoho.com/)
   - Create a new **"Server-based Applications"** client
   - Set the redirect URI to match your `INTEGRATION_AUTH_ZOHO_REDIRECT_URI`
   - Note: This integration uses the **authorization code flow** (`response_type=code`) as per [Zoho's Web App OAuth spec](https://www.zoho.com/accounts/protocol/oauth/web-apps/authorization.html)

2. **Configure Scopes**:
   The integration requests the following scopes:
   - `ZohoProjects.projects.ALL` - Full access to projects
   - `ZohoProjects.portals.ALL` - Full access to portals (workspaces)
   - `ZohoProjects.tasks.ALL` - Full access to tasks
   - `ZohoProjects.users.ALL` - Full access to users

3. **Set Environment Variables**:
   Add the client ID, client secret, and redirect URI to your environment

## API Key Authentication

Alternatively, you can use Zoho API tokens:

1. Generate an API token from your Zoho account settings
2. Select "API Key" as the auth type in the integration form
3. Enter your API token

{{ ... }}

```typescript
import { ZohoAuthIntegration } from '@noco-integrations/zoho-auth';

// Create integration instance
const zohoAuth = new ZohoAuthIntegration(config);

// Authenticate and get API client
const client = await zohoAuth.authenticate();

// Test connection
const result = await zohoAuth.testConnection();

// Exchange authorization code for tokens
const tokens = await zohoAuth.exchangeToken({ code: 'auth_code' });

// Refresh access token
const newTokens = await zohoAuth.refreshToken({ refresh_token: 'refresh_token' });
```

## API Reference

### Zoho Projects API

- **Base URL**: `https://projectsapi.zoho.{datacenter}/restapi`
- **Documentation**: https://www.zoho.com/projects/api-docs
- **OAuth Guide**: https://www.zoho.com/accounts/protocol/oauth.html

### Authentication Header

Zoho uses a custom authentication header format:

Authorization: Zoho-oauthtoken {access_token}

## Token Lifecycle

### OAuth (Authorization Code Flow)
- **Access Token**: Valid for 1 hour
- **Refresh Token**: Valid for extended period (no expiration by default)
- **Auto-refresh**: Integration automatically refreshes tokens when they expire
- **Secure**: Uses PKCE (Proof Key for Code Exchange) for enhanced security

### API Key
- **No Expiration**: API keys don't expire unless manually revoked
- **Recommended**: For automated/background processes

## Error Handling

The integration handles common errors:

- **401 Unauthorized**: Automatically attempts token refresh for OAuth
- **Invalid credentials**: Returns descriptive error messages
- **Network errors**: Proper error propagation

## Testing

1. Authenticates with Zoho
2. Fetches portals (workspaces) to verify access
3. Automatically refreshes tokens if needed
4. Returns success/failure status

## References

- [Zoho OAuth Documentation](https://www.zoho.com/accounts/protocol/oauth.html)
- [Zoho Projects API](https://www.zoho.com/projects/api-docs)
- [Zoho API Console](https://api-console.zoho.com/)
