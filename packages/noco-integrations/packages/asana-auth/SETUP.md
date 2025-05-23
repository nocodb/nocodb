# Asana Auth Integration Setup

This document provides instructions for setting up the Asana authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with Asana, you need to set up the following environment variables:

### Step 1: Create an Asana OAuth App

1. Log in to your Asana account
2. Navigate to your Asana Developer Console: https://app.asana.com/0/developer-console
3. Click on "Create New Application"
4. Fill out the form:
   - **App Name**: Your application name (e.g., "NocoDB")
   - **Redirect URI**: The URL where Asana will redirect users after authorization (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/asana/callback`)
   - **App URL**: Your application's homepage URL
   - **App Description**: Brief description of your application
   - **Allow anyone to sign in to this app**: Choose according to your needs
5. Click "Create App"

### Step 2: Get Client ID and Client Secret

After creating your OAuth application:
1. You'll be shown the Client ID and Client Secret in the "App Credentials" section
2. Copy these values as they will be needed for configuration

### Step 3: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```
INTEGRATION_AUTH_ASANA_CLIENT_ID=your_asana_client_id
INTEGRATION_AUTH_ASANA_CLIENT_SECRET=your_asana_client_secret
INTEGRATION_AUTH_ASANA_REDIRECT_URI=your_redirect_uri
```

Where:
- `your_asana_client_id`: The Client ID from your Asana OAuth App
- `your_asana_client_secret`: The Client Secret from your Asana OAuth App
- `your_redirect_uri`: The redirect URI you specified when creating the OAuth App (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/asana/callback`)

## Personal Access Token Authentication

If you're using Personal Access Token authentication instead of OAuth:

1. Log in to your Asana account
2. Navigate to your Asana Developer Console: https://app.asana.com/0/developer-console
3. Click on "Personal access tokens" in the left menu
4. Click "New access token"
5. Enter a description for your token
6. Click "Create"
7. Copy the generated token (you won't be able to see it again)

You'll need to provide this Personal Access Token when configuring the integration with the API Key authentication method.

## OAuth Scopes

This integration uses the `default` scope for Asana, which includes:
- Read and write access to tasks, projects, and workspaces
- Access to user information

The default scope provides all the permissions needed for the integration to function properly. 