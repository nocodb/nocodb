# Bamboo HR Auth Integration Setup

This document provides instructions for setting up the Bamboo HR authentication integration for NocoDB.

## Environment Variables

To enable OAuth2 authentication with Bamboo HR, you need to configure the following environment variables.

---

## Step 1: Create a Bamboo HR OAuth Consumer

1. Create an account at BambooHR's [developer portal](https://developers.bamboohr.com/login)
2. Create an application in the developer portal to get a client ID and secret
3. On the application page, add redirect url to your nocodb instance, e.g.: https://your-nocodb-instance.com

---

## Step 2: Get Client ID and Client Secret

After creating your OAuth consumer:

1. On your developer application page, Bamboo HR will display:
   * **Key** → Client ID
   * **Secret** → Client Secret
2. Copy both values
3. Store them safely for configuration

---

## Step 3: Set Environment Variables

Configure your NocoDB instance with:

```
INTEGRATION_AUTH_BAMBOOHR_CLIENT_ID=your_bamboohr_client_id
INTEGRATION_AUTH_BAMBOOHR_CLIENT_SECRET=your_bamboohr_client_secret
INTEGRATION_AUTH_BAMBOOHR_REDIRECT_URI=your_redirect_uri
```

Where:

* `your_bamboohr_client_id` → The **Key (Client ID)** from Bamboo HR
* `your_bamboohr_client_secret` → The **Secret (Client Secret)**
* `your_redirect_uri` → The callback URL used in the OAuth consumer. Use the one that's added at Bamboo HR developer application page
* 
  (e.g., `https://your-nocodb-instance.com/`).

---

## OAuth Scopes Requested

The integration will request these Bamboo HR scopes:

// TODO: filter unused oauth scopes


* `access_level`
* `benchmarking:compensation`
* `benefit`
* `company_file`
* `company:info`
* `company:administration`
* `data_cleaner`
* `payroll`
* `employee:assets`
* `employee:emergency_contacts`
* `employee:vaccination`
* `employee:custom_fields`
* `employee:custom_fields_encrypted`
* `employee:demographic`
* `employee:dependent`
* `employee:dependent:ssn`
* `employee:education`
* `employee:contact`
* `employee:identification`
* `employee:job`
* `employee:management`
* `employee:photo`
* `employee`
* `employee:name`
* `employee_directory`
* `employee:file`
* `employee:compensation`
* `employee:providers`
* `employee:providers:payroll`
* `sensitive_employee:protected_info`
* `sensitive_employee:address`
* `sensitive_employee:creditcards`
* `field`
* `goal`
* `job_opening`
* `application`
* `offline_access`
* `openid`
* `report`
* `tasks`
* `time_off`
* `time_tracking`
* `time_tracking:breaks`
* `training`
* `user`
* `user:management`
* `webhooks`
* `error_management`
* `public.integration`
* `public.user`
* `gridlets`

// TODO: complete informations
These permissions allow NocoDB to read/write employees data, ..., and pull requests as needed.
