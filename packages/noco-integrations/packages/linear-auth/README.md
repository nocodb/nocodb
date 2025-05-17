# Linear Auth Integration for NocoDB

This package provides Linear authentication integration for NocoDB, supporting both API Key and OAuth2 authentication methods.

## Features

- API Key authentication
- OAuth2 authentication
- Access to Linear API via Linear SDK
- Simple integration with Linear projects and issues

## Authentication Methods

### API Key Authentication

To authenticate using a Linear API Key:

1. Log in to your Linear account
2. Navigate to Settings > API > Personal API keys (or go directly to https://linear.app/settings/api)
3. Under "Personal API keys", enter a name for your key (e.g., "NocoDB Integration")
4. Click "Create key"
5. Copy the generated API key (you won't be able to see it again)
6. In the NocoDB Linear Auth integration configuration:
   - Paste the generated API key
   - Select "API Key" as the authentication method

### OAuth Authentication

To authenticate using Linear OAuth:

1. Ensure your NocoDB instance is properly configured with Linear OAuth credentials (see SETUP.md)
2. In the NocoDB Linear Auth integration configuration:
   - Select "OAuth2" as the authentication method
3. Click the "Connect to Linear" button
4. You will be redirected to Linear to authorize the application
5. Grant the requested permissions
6. You will be redirected back to NocoDB with the authentication completed

## Required Permissions

This integration requires the following Linear permissions:
- `read`: Read access to workspace data
- `write`: Write access to workspace data

These permissions allow the integration to read and modify issues, projects, and other data in your Linear workspace.

## Considerations

- API Key authentication provides access to all the data the key owner has access to
- OAuth authentication allows for more granular control and user-specific access
- For team or organization-wide integrations, OAuth is generally recommended 