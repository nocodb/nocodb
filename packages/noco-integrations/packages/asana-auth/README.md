# Asana Auth Integration for NocoDB

This package provides Asana authentication integration for NocoDB, supporting both Personal Access Token and OAuth2 authentication methods.

## Features

- Personal Access Token authentication
- OAuth2 authentication
- Access to Asana API via official Asana SDK
- Integration with Asana workspaces, projects, and tasks

## Authentication Methods

### Personal Access Token Authentication

To authenticate using an Asana Personal Access Token:

1. Log in to your Asana account
2. Navigate to your Asana Developer Console: https://app.asana.com/0/developer-console
3. Click on "Personal access tokens" in the left menu
4. Click "New access token"
5. Enter a description for your token (e.g., "NocoDB Integration")
6. Click "Create"
7. Copy the generated token (you won't be able to see it again)
8. In the NocoDB Asana Auth integration configuration:
   - Paste the generated token
   - Select "API Key" as the authentication method

### OAuth Authentication

To authenticate using Asana OAuth:

1. Ensure your NocoDB instance is properly configured with Asana OAuth credentials (see SETUP.md)
2. In the NocoDB Asana Auth integration configuration:
   - Select "OAuth2" as the authentication method
3. Click the "Connect to Asana" button
4. You will be redirected to Asana to authorize the application
5. Grant the requested permissions
6. You will be redirected back to NocoDB with the authentication completed

## Required Permissions

This integration uses the `default` scope for Asana, which includes:
- Read and write access to tasks, projects, and workspaces
- Access to user information

These permissions allow the integration to read and modify tasks, projects, and other data in your Asana workspaces.

## Considerations

- Personal Access Token authentication provides access to all the data the token owner has access to
- OAuth authentication allows for more granular control and user-specific access
- For team or organization-wide integrations, OAuth is generally recommended
- The integration works with both free and premium Asana workspaces 