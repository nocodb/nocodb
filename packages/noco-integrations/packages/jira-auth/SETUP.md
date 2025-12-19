# Jira Auth Integration Setup

This document provides instructions for setting up the Jira authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with Jira, you need to set up the following environment variables:

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