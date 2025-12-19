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

## Required Permissions

This integration requires the following Jira permissions:
- `read:jira-user`: Read-only access to user information
- `read:jira-work`: Read-only access to Jira issues and projects
- `write:jira-work`: Write access to Jira issues and projects

## Supported Jira Products

This integration is designed to work with Jira Cloud. It may not work with self-hosted Jira Server or Jira Data Center installations. 