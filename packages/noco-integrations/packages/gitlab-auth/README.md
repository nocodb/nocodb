# GitLab Auth Integration for NocoDB

This package provides GitLab authentication integration for NocoDB, supporting both API Key and OAuth2 authentication methods.

## Features

- API Key authentication
- OAuth2 authentication
- Access to GitLab API via Gitbeaker

## Setup Environment Variables

To enable OAuth2 authentication with GitLab, you need to set up the following environment variables:

### Step 1: Create a GitLab OAuth Application

1. Log in to your GitLab account
2. Navigate to User Settings > Applications (or for organization-wide application, go to your Group settings > Applications)
3. Fill out the form:
   - **Name**: Your application name (e.g., "NocoDB")
   - **Redirect URI**: The URL where GitLab will redirect users after authorization (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/gitlab/callback`)
   - **Scopes**: Select the following scopes:
     - `api` (API access)
     - `read_user` (Read user information)
4. Click "Save application"

### Step 2: Get Application ID and Secret

After creating your OAuth App, you'll be provided with:
- Application ID (Client ID)
- Secret (Client Secret)

### Step 3: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```
INTEGRATION_AUTH_GITLAB_CLIENT_ID=your_gitlab_client_id
INTEGRATION_AUTH_GITLAB_CLIENT_SECRET=your_gitlab_client_secret
INTEGRATION_AUTH_GITLAB_REDIRECT_URI=your_redirect_uri
```

Where:
- `your_gitlab_client_id`: The Application ID from your GitLab OAuth App
- `your_gitlab_client_secret`: The Secret from your GitLab OAuth App
- `your_redirect_uri`: The callback URL you specified when creating the OAuth App (e.g., `https://your-nocodb-instance.com/api/v1/integrations/auth/gitlab/callback`)

## OAuth Scopes

This integration requests the following GitLab scopes:
- `api`: Access to the GitLab API
- `read_user`: Read-only access to user profile data

## Usage

Once configured, the GitLab Auth integration will appear in the NocoDB integrations list, allowing users to authenticate with GitLab either using their API token or through the OAuth flow. 