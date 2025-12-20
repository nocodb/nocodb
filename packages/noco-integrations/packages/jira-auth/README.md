# Jira Auth Integration for NocoDB

This package provides Jira authentication integration for NocoDB, supporting both API Key and OAuth2 authentication methods.

## Features

- API Key authentication
- OAuth2 authentication
- Access to Jira API via jira-client
- Works with Jira Cloud

## Authentication Methods

### API Key Authentication

To authenticate using a Jira API Key:

1. Log in to your Atlassian account
2. Navigate to https://id.atlassian.com/manage-profile/security/api-tokens
3. Click "Create API token"
4. Provide a label for your token (e.g., "NocoDB Integration")
5. Click "Create"
6. Copy the generated token
7. In the NocoDB Jira Auth integration configuration:
   - Enter your Jira Cloud URL (e.g., `https://your-domain.atlassian.net`)
   - Enter your Atlassian account email address
   - Paste the generated API token
   - Select "API Key" as the authentication method

### OAuth2 Authentication

OAuth2 authentication provides a secure and user-friendly way to authenticate with Jira. 

#### Prerequisites

Before setting up OAuth2, ensure the following environment variables are configured:

- `INTEGRATION_AUTH_JIRA_CLIENT_ID`: OAuth client ID from Atlassian developer console
- `INTEGRATION_AUTH_JIRA_CLIENT_SECRET`: OAuth client secret from Atlassian developer console
- `INTEGRATION_AUTH_JIRA_REDIRECT_URI`: Redirect URI configured in Atlassian OAuth app (e.g., `https://<your-nocodb-host>/`)

#### Setting Up OAuth2 in Atlassian

1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Click "Create" → "OAuth 2.0 integration"
3. Add a name for your integration (e.g., "NocoDB Integration")
4. Select "Jira" for the product scopes
5. In the "Authorization" section:
   - Set the callback URL to your `INTEGRATION_AUTH_JIRA_REDIRECT_URI` (e.g., `https://<your-nocodb-host>/`)
6. In the "Permissions" section, enable the following scopes:
   - `read:jira-user`: Read-only access to user information
   - `read:jira-work`: Read-only access to Jira issues and projects
   - `write:jira-work`: Write access to Jira issues and projects (if needed)
7. Save the configuration
8. Copy the "Client ID" and "Secret" and set them as environment variables:
   - `INTEGRATION_AUTH_JIRA_CLIENT_ID`
   - `INTEGRATION_AUTH_JIRA_CLIENT_SECRET`

#### Configuring OAuth2 in NocoDB

1. In the NocoDB Jira Auth integration configuration:
   - Select "OAuth" as the authentication method
   - Enter your Jira company name (domain) - this is the part before `.atlassian.net` (e.g., if your Jira URL is `https://mycompany.atlassian.net`, enter `mycompany`)
   - Click the "OAuth Configuration" button to initiate the OAuth flow
2. You will be redirected to Atlassian's authorization page
3. Log in with your Atlassian account and grant the requested permissions
4. You will be redirected back to NocoDB with the authorization code
5. The integration will automatically exchange the authorization code for an access token

#### OAuth Flow Process

The OAuth2 flow follows these steps:

1. **Authorization Request**: When you click "OAuth Configuration" in NocoDB, you're redirected to Atlassian's authorization server
2. **User Consent**: You log in and grant permissions to the application
3. **Authorization Code**: Atlassian redirects you back to NocoDB with an authorization code
4. **Token Exchange**: NocoDB exchanges the authorization code (along with a code verifier for PKCE) for an access token and refresh token
5. **Access Token**: The access token is used to authenticate API requests to Jira
6. **Token Refresh**: When the access token expires, the refresh token is used to obtain a new access token automatically

The integration uses PKCE (Proof Key for Code Exchange) for enhanced security, which prevents authorization code interception attacks.

## Required Permissions

This integration requires the following Jira permissions:
- `read:jira-user`: Read-only access to user information
- `read:jira-work`: Read-only access to Jira issues and projects
- `write:jira-work`: Write access to Jira issues and projects

## Supported Jira Products

This integration is designed to work with Jira Cloud. It may not work with self-hosted Jira Server or Jira Data Center installations. 