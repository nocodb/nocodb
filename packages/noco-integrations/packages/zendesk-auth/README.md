# Zendesk Auth Integration for NocoDB

This package provides Zendesk Support OAuth 2.0 authentication integration for NocoDB.

## Features

- OAuth 2.0 authentication (Authorization Code Grant Flow)
- Access to Zendesk Support API
- Token refresh support
- Access to tickets, users, organizations, and other Zendesk resources
- Support for both account-specific and global OAuth clients

## Authentication Method

### OAuth Authentication

To authenticate using Zendesk OAuth:

1. Ensure your NocoDB instance is properly configured with Zendesk OAuth credentials (see SETUP.md)
2. In the NocoDB Zendesk Auth integration configuration:
   - Enter your Zendesk subdomain (e.g., "yourcompany" from yourcompany.zendesk.com)
   - Select "OAuth2" as the authentication method
3. Click the "Connect to Zendesk" button
4. You will be redirected to Zendesk to authorize the application
5. Grant the requested permissions
6. You will be redirected back to NocoDB with the authentication completed

## Required Permissions

This integration requests the following Zendesk permissions (scopes):
- `read`: Read access to all resources (GET endpoints, including sideloaded resources)
- `write`: Write access to all resources (POST, PUT, DELETE endpoints)

You can also configure fine-grained scopes for specific resources:
- `tickets:read`, `tickets:write` - Ticket access
- `users:read`, `users:write` - User access
- `organizations:read`, `organizations:write` - Organization access
- `auditlogs:read` - Audit log access (read-only)
- And more (see Zendesk OAuth documentation)

## API Access

Once authenticated, the integration provides access to the Zendesk Support API at `https://{subdomain}.zendesk.com/api/v2`. You can use this to:
- Manage tickets and support requests
- Access and update users and organizations
- View audit logs
- Manage triggers, automations, and webhooks
- Access Help Center content

## Token Management

- **Access Token**: Provided for API authentication
- **Refresh Token**: Provided for renewing access tokens when they expire
- **Token Expiration**: Tokens may have expiration times (check `expires_in` parameter)
- **Token Revocation**: Tokens can be revoked through Zendesk admin interface

The integration automatically handles token refresh when the access token expires.

## Considerations

- OAuth authentication provides secure, user-specific access to Zendesk
- Tokens are automatically refreshed when they expire
- You can revoke access at any time through the Zendesk admin interface (Admin Center > Apps and integrations > APIs > OAuth clients)
- All API requests are made over HTTPS for security
- Use your Zendesk subdomain (e.g., "yourcompany"), not custom domains
