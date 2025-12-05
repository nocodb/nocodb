# Dropbox Auth Integration

Authentication integration for Dropbox API in NocoDB.

## Features

- **Access Token Authentication**: Simple access token based authentication
- **OAuth2 Authentication**: Full OAuth2 support with authorization code flow
- **API Client**: Built-in HTTP client for Dropbox API v2
- **Secure Storage**: Credentials are stored securely via NocoDB integrations framework

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

1. Click the "Connect to Dropbox" button in the NocoDB Dropbox Auth integration configuration
2. You will be redirected to Dropbox to authorize the application
3. Grant the requested permissions
4. You will be redirected back to NocoDB with the authentication completed

## Required Permissions

This integration requests the following Dropbox scopes:
- `files.content.read`: Read file contents
- `files.content.write`: Write file contents
- `files.metadata.read`: Read file metadata
- `files.metadata.write`: Write file metadata
- `account_info.read`: Read account information

## API Client Usage

The integration returns a pre-configured HTTP client for the Dropbox API v2 (using `axios` under the hood):

```typescript
const client = await integration.authenticate();

// Get current account info
const { data: account } = await client.post('/users/get_current_account', null);

// List files in a folder
const { data: files } = await client.post('/files/list_folder', {
  path: '/',
});

// Download a file
const { data: file } = await client.post('/files/download', {
  path: '/example.txt',
});
```

## Dropbox API Documentation

- `https://www.dropbox.com/developers/documentation/http/overview`

## Error Handling

The integration surfaces meaningful error messages for:
- Invalid or missing access token
- Expired OAuth tokens
- Permission errors for specific API endpoints
- Network or API request failures

## Security

- Access tokens are never exposed to the frontend
- Credentials are stored and managed by NocoDB's secure integrations framework
- All requests to Dropbox are made over HTTPS
