# Jira Auth Integration Setup

This document provides instructions for setting up the Jira authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with Jira, set the following environment variables:

- `INTEGRATION_AUTH_JIRA_CLIENT_ID`: OAuth client ID from Atlassian developer console
- `INTEGRATION_AUTH_JIRA_CLIENT_SECRET`: OAuth client secret from Atlassian developer console
- `INTEGRATION_AUTH_JIRA_REDIRECT_URI`: Redirect URI configured in Atlassian OAuth app

## OAuth2 Setup

Steps to configure OAuth2 authentication:

1. Go to https://developer.atlassian.com/console/myapps/ and click "Create" → "OAuth 2.0 integration".
2. Add a name and select "Jira" for the product scopes.
3. In "Authorization", set the callback URL to your `INTEGRATION_AUTH_JIRA_REDIRECT_URI` (e.g., `https://<your-nocodb-host>/`).
4. In "Permissions", enable the scopes below and save.
5. Copy the "Client ID" and "Secret" into `INTEGRATION_AUTH_JIRA_CLIENT_ID` and `INTEGRATION_AUTH_JIRA_CLIENT_SECRET`.
6. In NocoDB, choose Jira OAuth authentication and provide the same redirect URL and base URL.

## API Token Authentication

Steps to use API Token authentication:

1. Log in to your Atlassian account
2. Navigate to https://id.atlassian.com/manage-profile/security/api-tokens
3. Click "Create API token"
4. Provide a label for your token
5. Click "Create"
6. Copy the generated token

You'll need to provide this token, along with your Jira email address and Jira Cloud URL when configuring the integration.

## Token Scopes

This integration requests the following Jira scopes:
- `read:jira-user`: Read-only access to user information
- `read:jira-work`: Read-only access to Jira issues and projects
- `write:jira-work`: Write access to Jira issues and projects 