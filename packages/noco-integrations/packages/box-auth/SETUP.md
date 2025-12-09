# Box Auth Integration Setup

This document provides step-by-step instructions for setting up the Box authentication integration for NocoDB, including OAuth2 configuration.

## Prerequisites

- A Box account
- Access to your NocoDB instance's environment configuration
- Admin access to configure integrations

## Environment Variables

To enable OAuth2 authentication with Box, configure the following environment variables in your NocoDB instance.

---

## Step 1: Create a Box Developer App

1. Log in to your Box account
2. Navigate to [Box Developer Console](https://developer.box.com/)
3. Click "My Apps" → "Create New App"
4. Choose "Custom App" → **"OAuth 2.0 with User Authentication"** (required for this integration)
5. Fill out the form:
   - **App Name**: Your app name (e.g., "NocoDB")
   - **Description**: (Optional) Description of your app
6. Click "Create App"

---

## Step 2: Configure OAuth Settings

1. In your Box app, navigate to the "Configuration" tab
2. Under "OAuth 2.0 Credentials", you'll see your **Client ID** and **Client Secret**
3. Under "Redirect URIs", add your callback URL:
   - Example: `https://your-nocodb-instance.com/api/v2/integrations/oauth/callback`
   - **Important**: This must match exactly with the `INTEGRATION_AUTH_BOX_REDIRECT_URI` environment variable
   - The exact callback path may vary by NocoDB deployment - check your NocoDB instance's integration callback endpoint
4. Click "Save Changes"

---

## Step 3: Configure Application Scopes

1. In your Box app, navigate to the "Scopes" section
2. Enable the following scope:
   - `root_readonly` – Read all files and folders stored in Box
3. Click "Save Changes"

---

## Step 4: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```bash
INTEGRATION_AUTH_BOX_CLIENT_ID=your_box_client_id
INTEGRATION_AUTH_BOX_CLIENT_SECRET=your_box_client_secret
INTEGRATION_AUTH_BOX_REDIRECT_URI=your_redirect_uri
```

Where:

- `your_box_client_id` → The **Client ID** from Box Developer Console
- `your_box_client_secret` → The **Client Secret** from Box Developer Console
- `your_redirect_uri` → The callback URL you specified in OAuth settings (e.g., `https://your-nocodb-instance.com/api/v2/integrations/oauth/callback`)

### Environment Variable Details

| Variable | Description | Required |
| --- | --- | --- |
| `INTEGRATION_AUTH_BOX_CLIENT_ID` | Box OAuth Client ID | Yes (for OAuth) |
| `INTEGRATION_AUTH_BOX_CLIENT_SECRET` | Box OAuth Client Secret | Yes (for OAuth) |
| `INTEGRATION_AUTH_BOX_REDIRECT_URI` | OAuth callback URL | Yes (for OAuth) |

**Note**: 
- All three variables (`CLIENT_ID`, `CLIENT_SECRET`, and `REDIRECT_URI`) must be set together for OAuth to work - partial configuration will not enable OAuth
- If these environment variables are not set, the Box Auth integration will not be available

---

## OAuth Scopes Requested

The integration requests these Box scopes during OAuth authorization:

- `root_readonly` - Read-only access to all files and folders

This permission allows NocoDB to read files, access file metadata, and retrieve account information as needed for sync operations.

**Note**: If you plan to extend functionality to include write operations (e.g., creating or updating files), you may need to request additional scopes. Currently, only `root_readonly` is required for read-only sync operations.

---

## Verification

After configuring the environment variables:

1. Restart your NocoDB instance to load the new environment variables
2. Navigate to the integrations page in NocoDB
3. Create a new Box Auth integration
4. Verify that "OAuth2" option is available in the auth type dropdown
5. Test the OAuth flow by clicking "Connect to Box"

---

## Troubleshooting

### OAuth Option Not Available

- Verify all three environment variables (`CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`) are set correctly
- Ensure no environment variables are empty or have trailing whitespace
- Restart NocoDB after setting environment variables
- Check that the redirect URI in Box Developer Console matches `INTEGRATION_AUTH_BOX_REDIRECT_URI` exactly
- Verify you selected "OAuth 2.0 with User Authentication" (not JWT/Server Authentication) when creating the Box app

### OAuth Flow Fails

- Verify the redirect URI matches exactly between Box Developer Console and environment variable
- Check that the Client ID and Client Secret are correct
- Ensure the redirect URI uses HTTPS (required by Box)
- Verify that the `root_readonly` scope is enabled in your Box app
- Check that the OAuth settings are properly configured

---

## Additional Resources

- [Box API Documentation](https://developer.box.com/guides/api-calls/)
- [Box OAuth 2.0 Guide](https://developer.box.com/guides/authentication/oauth2/)
- [Box Developer Console](https://developer.box.com/)
- [Box API Reference](https://developer.box.com/reference)
