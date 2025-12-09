# Google Drive Auth Integration Setup

This document provides step-by-step instructions for setting up the Google Drive authentication integration for NocoDB, including OAuth2 configuration.

## Prerequisites

- A Google account
- Access to your NocoDB instance's environment configuration
- Admin access to configure integrations

## Environment Variables

To enable OAuth2 authentication with Google Drive, configure the following environment variables in your NocoDB instance.

---

## Step 1: Create a Google Cloud Project

1. Log in to your Google account
2. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
3. Click "Select a project" → "New Project"
4. Fill out the form:
   - **Project name**: Your project name (e.g., "NocoDB")
   - **Organization**: (Optional) Select your organization
   - **Location**: (Optional) Select a location
5. Click "Create"

---

## Step 2: Enable Google Drive API

1. In your Google Cloud project, navigate to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on "Google Drive API"
4. Click "Enable"

---

## Step 3: Configure OAuth Consent Screen

1. Navigate to "APIs & Services" → "OAuth consent screen"
2. Choose user type:
   - **Internal**: For Google Workspace users only
   - **External**: For all Google users (requires verification for production)
3. Fill out the OAuth consent screen form:
   - **App name**: Your application name (e.g., "NocoDB")
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
   - **App logo**: (Optional) Upload a logo
4. Click "Save and Continue"
5. On the "Scopes" page, click "Add or Remove Scopes"
6. Add the following scope:
   - `https://www.googleapis.com/auth/drive.readonly`
7. Click "Update" → "Save and Continue"
8. On the "Test users" page (if External), add test users if needed
9. Click "Save and Continue" → "Back to Dashboard"

---

## Step 4: Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen (follow Step 3)
4. Choose application type: **Web application**
5. Fill out the form:
   - **Name**: Your OAuth client name (e.g., "NocoDB Google Drive Integration")
   - **Authorized redirect URIs**: Add your callback URL
     - Example: `https://your-nocodb-instance.com/api/v2/integrations/oauth/callback`
     - **Important**: This must match exactly with the `INTEGRATION_AUTH_GOOGLEDRIVE_REDIRECT_URI` environment variable
6. Click "Create"
7. You'll see a dialog with your **Client ID** and **Client Secret**
8. Copy both values and store them safely for configuration

---

## Step 5: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```bash
INTEGRATION_AUTH_GOOGLEDRIVE_CLIENT_ID=your_google_client_id
INTEGRATION_AUTH_GOOGLEDRIVE_CLIENT_SECRET=your_google_client_secret
INTEGRATION_AUTH_GOOGLEDRIVE_REDIRECT_URI=your_redirect_uri
```

Where:

- `your_google_client_id` → The **Client ID** from Google Cloud Console
- `your_google_client_secret` → The **Client Secret** from Google Cloud Console
- `your_redirect_uri` → The callback URL you specified in OAuth credentials (e.g., `https://your-nocodb-instance.com/api/v2/integrations/oauth/callback`)

### Environment Variable Details

| Variable | Description | Required |
| --- | --- | --- |
| `INTEGRATION_AUTH_GOOGLEDRIVE_CLIENT_ID` | Google OAuth Client ID | Yes (for OAuth) |
| `INTEGRATION_AUTH_GOOGLEDRIVE_CLIENT_SECRET` | Google OAuth Client Secret | Yes (for OAuth) |
| `INTEGRATION_AUTH_GOOGLEDRIVE_REDIRECT_URI` | OAuth callback URL | Yes (for OAuth) |

**Note**: If these environment variables are not set, only API Key (access token) authentication will be available in the integration form.

---

## OAuth Scopes Requested

The integration requests these Google Drive scopes during OAuth authorization:

- `https://www.googleapis.com/auth/drive.readonly` - Read-only access to files and metadata

This permission allows NocoDB to read files, access file metadata, and retrieve account information as needed for sync operations.

---

## Verification

After configuring the environment variables:

1. Restart your NocoDB instance to load the new environment variables
2. Navigate to the integrations page in NocoDB
3. Create a new Google Drive Auth integration
4. Verify that both "Access token" and "OAuth2" options are available in the auth type dropdown
5. Test the OAuth flow by selecting OAuth2 and clicking "Connect to Google Drive"

---

## Troubleshooting

### OAuth Option Not Available

- Verify all three environment variables are set correctly
- Restart NocoDB after setting environment variables
- Check that the redirect URI in Google Cloud Console matches `INTEGRATION_AUTH_GOOGLEDRIVE_REDIRECT_URI`

### OAuth Flow Fails

- Verify the redirect URI matches exactly between Google Cloud Console and environment variable
- Check that the Client ID and Client Secret are correct
- Ensure the redirect URI uses HTTPS (required by Google)
- Verify that Google Drive API is enabled in your Google Cloud project
- Check that the OAuth consent screen is properly configured

### Access Token Authentication

If you prefer to use access token authentication instead of OAuth:

1. Generate an access token using Google OAuth 2.0 Playground or your own OAuth flow
2. Use the "Access token" auth type in the integration form
3. No environment variables are required for access token authentication

---

## Additional Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/guides/about-sdk)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
