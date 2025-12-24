# Dropbox Auth Integration Setup

This document provides step-by-step instructions for setting up the Dropbox authentication integration for NocoDB, including OAuth2 configuration.

## Prerequisites

- A Dropbox account
- Access to your NocoDB instance's environment configuration
- Admin access to configure integrations

## Environment Variables

To enable OAuth2 authentication with Dropbox, configure the following environment variables in your NocoDB instance.

---

## Step 1: Create a Dropbox App

1. Log in to your Dropbox account
2. Navigate to [Dropbox App Console](https://www.dropbox.com/developers/apps)
3. Click "Create app"
4. Choose your app type:
   - **Scoped access**: For apps that need specific permissions (recommended)
   - **Full Dropbox**: For apps that need full access
5. Fill out the form:
   - **App name**: Your application name (e.g., "NocoDB")
   - **App folder name**: (Optional) A folder name for your app
   - **Type of access**: Choose based on your needs
6. Click "Create app"

---

## Step 2: Configure OAuth Settings

After creating your app:

1. In your app settings, navigate to the "OAuth 2" section
2. Add a redirect URI:
   - The callback URL where Dropbox will redirect users after authorization
   - Example: `https://your-nocodb-instance.com/api/v2/integrations/oauth/callback`
   - **Important**: This must match exactly with the `INTEGRATION_AUTH_DROPBOX_REDIRECT_URI` environment variable
3. Save the settings

---

## Step 3: Get Client ID and Client Secret

In your app settings, you'll find:

- **App key** → This is your Client ID
- **App secret** → This is your Client Secret

Copy both values and store them safely for configuration. Keep these credentials secure and never commit them to version control.

---

## Step 4: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```bash
INTEGRATION_AUTH_DROPBOX_CLIENT_ID=your_dropbox_client_id
INTEGRATION_AUTH_DROPBOX_CLIENT_SECRET=your_dropbox_client_secret
INTEGRATION_AUTH_DROPBOX_REDIRECT_URI=your_redirect_uri
```

Where:

- `your_dropbox_client_id` → The **App key (Client ID)** from Dropbox
- `your_dropbox_client_secret` → The **App secret (Client Secret)** from Dropbox
- `your_redirect_uri` → The callback URL you specified in your Dropbox app settings (e.g., `https://your-nocodb-instance.com/api/v2/integrations/oauth/callback`)

### Environment Variable Details

| Variable | Description | Required |
| --- | --- | --- |
| `INTEGRATION_AUTH_DROPBOX_CLIENT_ID` | Dropbox App key (Client ID) | Yes (for OAuth) |
| `INTEGRATION_AUTH_DROPBOX_CLIENT_SECRET` | Dropbox App secret (Client Secret) | Yes (for OAuth) |
| `INTEGRATION_AUTH_DROPBOX_REDIRECT_URI` | OAuth callback URL | Yes (for OAuth) |

**Note**: If these environment variables are not set, only API Key (access token) authentication will be available in the integration form.

---

## OAuth Scopes Requested

The integration requests these Dropbox scopes during OAuth authorization:

- `files.content.read` - Read file contents
- `files.metadata.read` - Read file and folder metadata
- `account_info.read` - Read account information

These permissions allow NocoDB to read files, access file metadata, and retrieve account information as needed for sync operations.

---

## Verification

After configuring the environment variables:

1. Restart your NocoDB instance to load the new environment variables
2. Navigate to the integrations page in NocoDB
3. Create a new Dropbox Auth integration
4. Verify that both "Access token" and "OAuth2" options are available in the auth type dropdown
5. Test the OAuth flow by selecting OAuth2 and clicking "Connect to Dropbox"

---

## Troubleshooting

### OAuth Option Not Available

- Verify all three environment variables are set correctly
- Restart NocoDB after setting environment variables
- Check that the redirect URI in Dropbox app settings matches `INTEGRATION_AUTH_DROPBOX_REDIRECT_URI`

### OAuth Flow Fails

- Verify the redirect URI matches exactly between Dropbox app settings and environment variable
- Check that the Client ID and Client Secret are correct
- Ensure the redirect URI uses HTTPS (required by Dropbox)

### Access Token Authentication

If you prefer to use access token authentication instead of OAuth:

1. Generate an access token from your Dropbox app console
2. Use the "Access token" auth type in the integration form
3. No environment variables are required for access token authentication

---

## Additional Resources

- [Dropbox OAuth Guide](https://www.dropbox.com/developers/reference/oauth-guide)
- [Dropbox API Documentation](https://www.dropbox.com/developers/documentation/http/overview)
- [Dropbox App Console](https://www.dropbox.com/developers/apps)
