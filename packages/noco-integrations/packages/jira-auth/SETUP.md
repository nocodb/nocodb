# Jira Auth Integration Setup

This document provides instructions for setting up the Jira authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with Jira, you need to set up the following environment variables:

### Step 1: Create a Jira OAuth App

1. Log in to your Atlassian account
2. Navigate to https://developer.atlassian.com/console/myapps/
3. Click on "Create" to create a new app
4. Fill out the form:
   - **App name**: Your application name (e.g., "NocoDB")
   - **Description**: Brief description of your app
   - Click "Create"
5. Once created, navigate to "Permissions" in the left sidebar
6. Under "OAuth 2.0", click on "Add" and select "Authorization code"
7. Configure the following:
   - **Callback URL**: The URL where Jira will redirect users after authorization (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/jira/callback`)
   - **Scopes**: Select the following scopes:
     - `read:jira-user`: Read-only access to user information
     - `read:jira-work`: Read-only access to Jira issues and projects
     - `write:jira-work`: Write access to Jira issues and projects

### Step 2: Get Client ID and Client Secret

After configuring your OAuth app:
1. Navigate to "Settings" in the left sidebar
2. Under "OAuth 2.0 (3LO)", you'll find your Client ID
3. Click "View credentials" to see your Client Secret

### Step 3: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```
INTEGRATION_AUTH_JIRA_CLIENT_ID=your_jira_client_id
INTEGRATION_AUTH_JIRA_CLIENT_SECRET=your_jira_client_secret
INTEGRATION_AUTH_JIRA_REDIRECT_URI=your_redirect_uri
```

Where:
- `your_jira_client_id`: The Client ID from your Jira OAuth App
- `your_jira_client_secret`: The Client Secret from your Jira OAuth App
- `your_redirect_uri`: The callback URL you specified when creating the OAuth App (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/jira/callback`)

## API Token Authentication

If you're using API Token authentication instead of OAuth:

1. Log in to your Atlassian account
2. Navigate to https://id.atlassian.com/manage-profile/security/api-tokens
3. Click "Create API token"
4. Provide a label for your token
5. Click "Create"
6. Copy the generated token

You'll need to provide this token, along with your Jira email address and Jira Cloud URL when configuring the integration.

## OAuth Scopes

This integration requests the following Jira scopes:
- `read:jira-user`: Read-only access to user information
- `read:jira-work`: Read-only access to Jira issues and projects
- `write:jira-work`: Write access to Jira issues and projects 