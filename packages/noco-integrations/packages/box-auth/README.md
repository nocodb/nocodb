# Google Drive Auth Integration

Authentication integration for Google Drive API in NocoDB. The package extends the `AuthIntegration` base class and provides an authenticated HTTP client for Google Drive API v3.

## Features

- **Access Token Authentication**: Simple access token based authentication
- **OAuth2 Authentication**: Full OAuth2 support with authorization code flow and token refresh
- **API Client**: Built-in HTTP client for Google Drive API v3 (using `axios` under the hood)
- **Rate Limiting**: Built-in rate limit handling (1000 requests per 100 seconds per user)
- **Secure Storage**: Credentials are stored securely via NocoDB integrations framework
- **Connection Testing**: Built-in connection test to verify authentication

## How It Works

1. Supports two authentication methods: API Key (access token) and OAuth2
2. For API Key: Uses the provided access token directly to authenticate requests
3. For OAuth2: Implements the authorization code flow with offline access for refresh tokens
4. Returns a pre-configured `AxiosInstance` with base URL `https://www.googleapis.com/drive/v3` and Bearer token authentication
5. All requests are rate-limited to 1000 requests per 100 seconds per user
6. The authenticated client can be used by other integrations (e.g., Google Drive Sync) to make API calls

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled
- For OAuth2: Google Cloud project with OAuth credentials configured (see SETUP.md)

### Auth Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this auth connection |
| `config.type` | Authentication type: `ApiKey` (access token) or `OAuth` |
| `config.token` | Google Drive access token (required for ApiKey type) |
| `config.oauth` | OAuth configuration (required for OAuth type) |

### Required Google Drive Permissions

Grant the OAuth token or API key the ability to:

- `https://www.googleapis.com/auth/drive.readonly` – read-only access to files and metadata

## Authentication Methods

### Access Token

To authenticate using a Google Drive access token:

1. Log in to your Google account
2. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
3. Create a new project or use an existing one
4. Enable Google Drive API for your project
5. Create OAuth 2.0 credentials and generate an access token
6. Copy the generated token and use it in the NocoDB Google Drive Auth integration configuration

### OAuth2 Authentication

To authenticate using Google Drive OAuth2:

1. Ensure OAuth credentials are configured (see SETUP.md)
2. Click the "Connect to Google Drive" button in the NocoDB Google Drive Auth integration configuration
3. You will be redirected to Google to authorize the application
4. Grant the requested permissions
5. You will be redirected back to NocoDB with the authentication completed

## API Endpoints Used

- `GET /about` – used for connection testing (retrieves user information)
- `POST /oauth2/v2/token` – OAuth token exchange and refresh

## Rate Limiting

- Google Drive allows 1000 requests per 100 seconds per user
- The integration automatically handles rate limiting with a queue size of 100 requests
- Requests exceeding the limit are queued and processed when capacity is available

## Error Handling & Limits

- Invalid or missing access token throws an error with a clear message
- Expired OAuth tokens can be refreshed using the `refreshToken()` method
- Permission errors for specific API endpoints surface the original Google Drive API error
- Network or API request failures are propagated with error details
- Connection test validates authentication by calling `/about` endpoint

## Usage Example

```typescript
import { Integration } from '@noco-integrations/core';

const authIntegration = await Integration.get(context, authIntegrationId);
const authWrapper = await authIntegration.getIntegrationWrapper();
const googleDriveAuth = await authWrapper.authenticate(); // Returns AxiosInstance

// Get user information
const { data: about } = await googleDriveAuth.get('/about', {
  params: {
    fields: 'user',
  },
});

// List files
const { data: files } = await googleDriveAuth.get('/files', {
  params: {
    q: "mimeType != 'application/vnd.google-apps.folder'",
    pageSize: 10,
  },
});

// Get file metadata
const { data: file } = await googleDriveAuth.get(`/files/${fileId}`, {
  params: {
    fields: 'id,name,mimeType,size,modifiedTime',
  },
});
```

## Google Drive API Documentation

- [Google Drive API Overview](https://developers.google.com/drive/api/guides/about-sdk)
- [Google Drive OAuth Guide](https://developers.google.com/identity/protocols/oauth2)

## Security

- Access tokens are never exposed to the frontend
- Credentials are stored and managed by NocoDB's secure integrations framework
- All requests to Google Drive are made over HTTPS
- OAuth tokens support refresh token rotation for enhanced security

## Next Steps

- Pair this integration with Google Drive Sync integration to sync files and folders
- Use the authenticated client in custom automations or workflows
- Monitor rate limit usage for large-scale operations
