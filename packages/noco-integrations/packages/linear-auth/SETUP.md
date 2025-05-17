# Linear Auth Integration Setup

This document provides instructions for setting up the Linear authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with Linear, you need to set up the following environment variables:

### Step 1: Create a Linear OAuth App

1. Log in to your Linear account
2. Navigate to Settings > API > OAuth applications (or go directly to https://linear.app/settings/api/applications)
3. Click on "New OAuth application"
4. Fill out the form:
   - **Name**: Your application name (e.g., "NocoDB")
   - **Description**: Brief description of your application
   - **Redirect URIs**: The URL where Linear will redirect users after authorization (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/linear/callback`)
   - **Icon**: (Optional) Upload an icon for your application
5. Click "Create"

### Step 2: Get Client ID and Client Secret

After creating your OAuth application:
1. You'll be shown the Client ID and Client Secret
2. Copy these values as they will be needed for configuration

### Step 3: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```
INTEGRATION_AUTH_LINEAR_CLIENT_ID=your_linear_client_id
INTEGRATION_AUTH_LINEAR_CLIENT_SECRET=your_linear_client_secret
INTEGRATION_AUTH_LINEAR_REDIRECT_URI=your_redirect_uri
```

Where:
- `your_linear_client_id`: The Client ID from your Linear OAuth App
- `your_linear_client_secret`: The Client Secret from your Linear OAuth App
- `your_redirect_uri`: The redirect URI you specified when creating the OAuth App (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/linear/callback`)

## API Key Authentication

If you're using API Key authentication instead of OAuth:

1. Log in to your Linear account
2. Navigate to Settings > API > Personal API keys (or go directly to https://linear.app/settings/api)
3. Under "Personal API keys", enter a name for your key
4. Click "Create key"
5. Copy the generated API key (you won't be able to see it again)

You'll need to provide this API key when configuring the integration with the API Key authentication method.

## OAuth Scopes

This integration requests the following Linear scopes:
- `read`: Read access to workspace data
- `write`: Write access to workspace data

These scopes allow the integration to read and modify issues, projects, and other data in your Linear workspace. 