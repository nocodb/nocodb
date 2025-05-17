# GitLab Auth Integration for NocoDB

This package provides GitLab authentication integration for NocoDB, supporting both API Key and OAuth2 authentication methods.

## Features

- API Key authentication
- OAuth2 authentication
- Access to GitLab API via Gitbeaker

## Authentication Methods

### API Key Authentication

To authenticate using a GitLab API Key (Personal Access Token):

1. Log in to your GitLab account
2. Navigate to User Settings > Access Tokens (or for project-specific tokens, go to your Project settings > Access Tokens)
3. Fill out the form:
   - **Name**: Give your token a descriptive name
   - **Expiration date**: (Optional) Set an expiration date for the token
   - **Scopes**: Select the following scopes:
     - `api` (API access)
     - `read_user` (Read user information)
4. Click "Create personal access token"
5. Copy the generated token and use it in the NocoDB GitLab Auth integration configuration

### OAuth Authentication

To authenticate using GitLab OAuth:

1. Click the "Connect to GitLab" button in the NocoDB GitLab Auth integration configuration
2. You will be redirected to GitLab to authorize the application
3. Grant the requested permissions
4. You will be redirected back to NocoDB with the authentication completed

## Required Permissions

This integration requires the following GitLab permissions:
- `api`: Access to the GitLab API
- `read_user`: Read-only access to user profile data
