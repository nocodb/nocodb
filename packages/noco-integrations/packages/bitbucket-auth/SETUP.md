# Bitbucket Auth Integration Setup

This document provides instructions for setting up the Bitbucket authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with Bitbucket, you need to configure the following environment variables.

---

## Step 1: Create a Bitbucket OAuth Consumer

1. Log in to your Bitbucket account
2. Navigate to Bitbucket Administration **Workspace settings → OAuth consumers**
   * (Bitbucket → left sidebar → click your workspace → **Workspace settings** → **OAuth consumers**)
3. Click on **“Add consumer”**
4. Fill out the form:

   * **Name**: Your application name (e.g., "NocoDB")
   * **Description**: Brief description of your application
   * **Callback URL**:
     `https://your-nocodb-instance.com/`
   * **Permissions**: Enable:

     * **Repositories**: Read & Write
     * **Pull requests**: Read & Write
     * **Issues**: Read & Write
     * **Account**: Read
5. Click **Save**

---

## Step 2: Get Client ID and Client Secret

After creating your OAuth consumer:

1. Bitbucket will display:

   * **Key** → Client ID
   * **Secret** → Client Secret
2. Copy both values (the Secret is shown **only once**)
3. Store them safely for configuration

---

## Step 3: Set Environment Variables

Configure your NocoDB instance with:

```
INTEGRATION_AUTH_BITBUCKET_CLIENT_ID=your_bitbucket_client_id
INTEGRATION_AUTH_BITBUCKET_CLIENT_SECRET=your_bitbucket_client_secret
INTEGRATION_AUTH_BITBUCKET_REDIRECT_URI=your_redirect_uri
```

Where:

* `your_bitbucket_client_id` → The **Key (Client ID)** from Bitbucket
* `your_bitbucket_client_secret` → The **Secret (Client Secret)**
* `your_redirect_uri` → The callback URL used in the OAuth consumer
  (e.g., `https://your-nocodb-instance.com/`)

---

## OAuth Scopes Requested

The integration will request these Bitbucket scopes:

* `repository`
* `repository:write`
* `pullrequest`
* `pullrequest:write`
* `issue`
* `issue:write`
* `account`

These permissions allow NocoDB to read/write repositories, issues, and pull requests as needed.
