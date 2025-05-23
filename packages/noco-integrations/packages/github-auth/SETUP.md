# GitHub Auth Integration Setup

This document provides instructions for setting up the GitHub authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with GitHub, you need to set up the following environment variables:

### Step 1: Create a GitHub OAuth App

1. Log in to your GitHub account
2. Navigate to Settings > Developer settings > OAuth Apps
3. Click on "New OAuth App"
4. Fill out the form:
   - **Application name**: Your application name (e.g., "NocoDB")
   - **Homepage URL**: Your application's homepage URL
   - **Application description**: (Optional) Brief description of your app
   - **Authorization callback URL**: The URL where GitHub will redirect users after authorization (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/github/callback`)
5. Click "Register application"

### Step 2: Get Client ID and Client Secret

After registering your OAuth App, you'll be provided with:
- Client ID
- Client Secret (click "Generate a new client secret" to create one)

### Step 3: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```
INTEGRATION_AUTH_GITHUB_CLIENT_ID=your_github_client_id
INTEGRATION_AUTH_GITHUB_CLIENT_SECRET=your_github_client_secret
INTEGRATION_AUTH_GITHUB_REDIRECT_URI=your_redirect_uri
```

Where:
- `your_github_client_id`: The Client ID from your GitHub OAuth App
- `your_github_client_secret`: The Client Secret from your GitHub OAuth App
- `your_redirect_uri`: The callback URL you specified when creating the OAuth App (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/github/callback`)

## OAuth Scopes

This integration requests the following GitHub scopes:
- `read:user`: Read-only access to user profile data
- `repo`: Full control of repositories 