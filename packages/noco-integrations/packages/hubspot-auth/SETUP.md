# HubSpot Auth Integration Setup

This document provides step-by-step instructions for setting up the HubSpot authentication integration for NocoDB, including OAuth2 configuration.

## Prerequisites

- A HubSpot developer account
- A HubSpot app (or create a new one)
- Access to your NocoDB instance's environment configuration
- Admin access to configure integrations

## Environment Variables

To enable OAuth2 authentication with HubSpot, configure the following environment variables in your NocoDB instance.

---

## Step 1: Create a HubSpot App

1. Log in to your [HubSpot Developer account](https://developers.hubspot.com/)
2. Navigate to the [Developer Dashboard](https://developers.hubspot.com/apps/)
3. Click "Create app"
4. Fill out the app information:
   - **App name**: Your application name (e.g., "NocoDB Integration")
   - **App logo**: (Optional) Upload a logo for your app
   - **App description**: Brief description of your integration
5. Click "Create app"

---

## Step 2: Configure OAuth Settings

After creating your app:

1. In your app settings, navigate to the "Auth" section
2. Under "Redirect URLs", add your NocoDB callback URL:
   - Example: `https://your-nocodb-instance.com/api/v2/integrations/oauth/callback`
   - **Important**: This must match exactly with the `INTEGRATION_AUTH_HUBSPOT_REDIRECT_URI` environment variable
3. Under "Scopes", add the following OAuth scopes:
   - `crm.objects.contacts.read` - Read access to contacts
   - `crm.objects.companies.read` - Read access to companies
   - `crm.schemas.contacts.read` - Read contact schemas
4. Save the settings

---

## Step 3: Get Client ID and Client Secret

In your HubSpot app settings, navigate to "Auth" and you'll find:

- **Client ID** - Your HubSpot app's unique identifier
- **Client Secret** - Your app's secret key (keep this secure)

Copy both values and store them safely for configuration. Keep these credentials secure and never commit them to version control.

---

## Step 4: Set Environment Variables

Configure your NocoDB instance with the following environment variables:

```bash
INTEGRATION_AUTH_HUBSPOT_CLIENT_ID=your_hubspot_client_id
INTEGRATION_AUTH_HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
INTEGRATION_AUTH_HUBSPOT_REDIRECT_URI=your_redirect_uri
```

Where:
- `your_hubspot_client_id` → The **Client ID** from HubSpot
- `your_hubspot_client_secret` → The **Client Secret** from HubSpot
- `your_redirect_uri` → The callback URL you specified in your HubSpot app settings

### Environment Variable Details

| Variable | Description | Required |
| --- | --- | --- |
| `INTEGRATION_AUTH_HUBSPOT_CLIENT_ID` | HubSpot Client ID | Yes (for OAuth) |
| `INTEGRATION_AUTH_HUBSPOT_CLIENT_SECRET` | HubSpot Client Secret | Yes (for OAuth) |
| `INTEGRATION_AUTH_HUBSPOT_REDIRECT_URI` | OAuth callback URL | Yes (for OAuth) |

**Note**: If these environment variables are not set, only API Key authentication will be available in the integration form.

---