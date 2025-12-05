# Dropbox Auth Integration Setup

This document provides instructions for setting up the Dropbox authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with Dropbox, you need to configure the following environment variables.

---

## Step 1: Create a Dropbox App

1. Log in to your Dropbox account
2. Navigate to [Dropbox App Console](https://www.dropbox.com/developers/apps)
3. Click "Create app"
4. Choose your app type:
   - **Scoped access**: For apps that need specific permissions
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
3. Save the settings

---

## Step 3: Get Client ID and Client Secret

In your app settings, you'll find:

- **App key** → This is your Client ID
- **App secret** → This is your Client Secret

Copy both values and store them safely for configuration.

---

## Step 4: Set Environment Variables

Configure your NocoDB instance with:

```
INTEGRATION_AUTH_DROPBOX_CLIENT_ID=your_dropbox_client_id
INTEGRATION_AUTH_DROPBOX_CLIENT_SECRET=your_dropbox_client_secret
INTEGRATION_AUTH_DROPBOX_REDIRECT_URI=your_redirect_uri
```

Where:

* `your_dropbox_client_id` → The **App key (Client ID)** from Dropbox
* `your_dropbox_client_secret` → The **App secret (Client Secret)** from Dropbox
* `your_redirect_uri` → The callback URL you specified in your Dropbox app settings (e.g., `https://your-nocodb-instance.com/api/v2/integrations/oauth/callback`)

---

## OAuth Scopes Requested

The integration will request these Dropbox scopes:

* `files.content.read` - Read file contents
* `files.content.write` - Write file contents
* `files.metadata.read` - Read file metadata
* `files.metadata.write` - Write file metadata
* `account_info.read` - Read account information

These permissions allow NocoDB to read and write files, access file metadata, and retrieve account information as needed.

## Additional Resources

- [Dropbox OAuth Guide](https://www.dropbox.com/developers/reference/oauth-guide)
- [Dropbox API Documentation](https://www.dropbox.com/developers/documentation/http/overview)
