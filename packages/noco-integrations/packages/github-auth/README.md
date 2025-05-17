# GitHub Auth Integration for NocoDB

This package provides GitHub authentication integration for NocoDB, supporting both API Key and OAuth2 authentication methods.

## Features

- API Key authentication
- OAuth2 authentication
- Access to GitHub API via Octokit

## Authentication Methods

### API Key Authentication

To authenticate using a GitHub API Key (Personal Access Token):

1. Log in to your GitHub account
2. Navigate to Settings > Developer settings > Personal access tokens
3. Click on "Generate new token"
4. Give your token a descriptive name
5. Select the required scopes:
   - `repo`: Full control of repositories
   - `read:user`: Read-only access to user profile data
6. Click "Generate token"
7. Copy the generated token and use it in the NocoDB GitHub Auth integration configuration

### OAuth Authentication

To authenticate using GitHub OAuth:

1. Click the "Connect to GitHub" button in the NocoDB GitHub Auth integration configuration
2. You will be redirected to GitHub to authorize the application
3. Grant the requested permissions
4. You will be redirected back to NocoDB with the authentication completed

## Required Permissions

This integration requires the following GitHub permissions:
- `read:user`: Read-only access to user profile data
- `repo`: Full control of repositories

