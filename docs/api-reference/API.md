# API Reference

> **nocodb** — Version 1.0

---

## `/api/v1/user/profile`

### PATCH /api/v1/user/profile

> **Update User Profile**


Update User Profile


**Operation ID:** `user-profile-update`


**Tags:** `User profile` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | Model for User |


---
## `/api/v1/auth/user/signup`

### POST /api/v1/auth/user/signup

> **Signup**


Create a new user with provided email and password and first user is marked as super admin. 


**Operation ID:** `auth-signup`


**Tags:** `Auth` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | Bad Request |


---
## `/api/v1/auth/user/signout`

### POST /api/v1/auth/user/signout

> **Signout**


Clear refresh token from the database and cookie.


**Operation ID:** `auth-signout`


**Tags:** `Auth` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/auth/user/signin`

### POST /api/v1/auth/user/signin

> **Signin**


Authenticate existing user with their email and password. Successful login will return a JWT access-token. 


**Operation ID:** `auth-signin`


**Tags:** `Auth` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/auth/user/me`

### GET /api/v1/auth/user/me

> **Get User Info**


Returns authenticated user info


**Operation ID:** `auth-me`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `base_id` | **query** |  (string) | ❌ No | Pass base id to get base specific roles along with user info |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/auth/password/forgot`

### POST /api/v1/auth/password/forgot

> **Forget Password**


Emails user with a reset url.


**Operation ID:** `auth-password-forgot`


**Tags:** `Auth` 



#### Request Body

Pass registered user email id in request body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/auth/password/change`

### POST /api/v1/auth/password/change

> **Change Password**


Change password of authenticated user with a new one.


**Operation ID:** `auth-password-change`


**Tags:** `Auth` 



#### Request Body

Old password need to be passed along with new password for changing password.

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/auth/token/validate/{token}`

### POST /api/v1/auth/token/validate/{token}

> **Verify Reset Token**


Validate password reset url token.


**Operation ID:** `auth-password-reset-token-validate`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/auth/email/validate/{token}`

### POST /api/v1/auth/email/validate/{token}

> **Verify Email**


Api for verifying email where token need to be passed which is shared to user email.


**Operation ID:** `auth-email-validate`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/auth/password/reset/{token}`

### POST /api/v1/auth/password/reset/{token}

> **Reset Password**


Update user password to new by using reset token.


**Operation ID:** `auth-password-reset`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/auth/token/refresh`

### POST /api/v1/auth/token/refresh

> **Refresh Token**


Creates a new refresh token and JWT auth token for the user. The refresh token is sent as a cookie, while the JWT auth token is included in the response body.


**Operation ID:** `auth-token-refresh`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/tokens`

### GET /api/v1/tokens

> **List Organisation API Tokens**


List all organisation API tokens.  Access with API tokens will be blocked.


**Operation ID:** `org-tokens-list`


**Tags:** `Org Tokens` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### POST /api/v1/tokens

> **Create Organisation API Token**


Creat an organisation API token. Access with API tokens will be blocked.


**Operation ID:** `org-tokens-create`


**Tags:** `Org Tokens` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/tokens/{tokenId}`

### DELETE /api/v1/tokens/{tokenId}

> **Delete Organisation API Tokens**


Delete an organisation API token. Access with API tokens will be blocked.


**Operation ID:** `org-tokens-delete`


**Tags:** `Org Tokens` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/license`

### GET /api/v1/license

> **Get App License**


Get the application license key. Exclusive for super admin.


**Operation ID:** `org-license-get`


**Tags:** `Org License` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### POST /api/v1/license

> **Create App License**


Set the application license key. Exclusive for super admin.


**Operation ID:** `org-license-set`


**Tags:** `Org License` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/app-settings`

### GET /api/v1/app-settings

> **Get App Settings**


Get the application settings. Exclusive for super admin.


**Operation ID:** `org-app-settings-get`


**Tags:** `Org App Settings` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### POST /api/v1/app-settings

> **Create App Settings**


Update the application settings. Exclusive for super admin.


**Operation ID:** `org-app-settings-set`


**Tags:** `Org App Settings` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/users`

### GET /api/v1/users

> **List Organisation Users**


List all organisation users. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `org-users-list`


**Tags:** `Org Users` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### POST /api/v1/users

> **Create Organisation User**


Create an organisation user. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `org-users-add`


**Tags:** `Org Users` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/users/{userId}`

### PATCH /api/v1/users/{userId}

> **Update Organisation User**


Update an organisation user by User ID. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `org-users-update`


**Tags:** `Org Users` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### DELETE /api/v1/users/{userId}

> **Delete Organisation User**


Delete an organisation user by User ID. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `org-users-delete`


**Tags:** `Org Users` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/users/{username}`

### GET /api/v1/users/{username}

> **Organisation User GetByUsername**


Organisation User GetByUsername


**Operation ID:** `org-users-get-by-username`


**Tags:** `Org users` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/users/{userId}/resend-invite`

### POST /api/v1/users/{userId}/resend-invite

> **Invite Organisation User**


Resend Invitation to a specific user. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `org-users-resend-invite`


**Tags:** `Org Users` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/users/{userId}/profile`

### POST /api/v1/users/{userId}/profile

> **Organisation User Profile - Create**


Create Organisation User Profile


**Operation ID:** `org-users-profile-create`


**Tags:** `Org users` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### GET /api/v1/users/{userId}/profile

> **Organisation User Profile - Get**


Get Organisation User Profile


**Operation ID:** `org-users-profile-get`


**Tags:** `Org users` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### PATCH /api/v1/users/{userId}/profile



Update Organisation User Profile



**Operation ID:** `org-users-profile-update`


**Tags:** `Org users` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/users/{userId}/follower`

### POST /api/v1/users/{userId}/follower

> **Organisation User Follower - Create**


Create Organisation User Follower Relationship (Follow)


**Operation ID:** `org-users-follower-create`


**Tags:** `Org users` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### GET /api/v1/users/{userId}/follower

> **Organisation User Follower - List**


List Organisation User Followers


**Operation ID:** `org-users-follower-list`


**Tags:** `Org users` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### DELETE /api/v1/users/{userId}/follower

> **Organisation User Follower - Delete**


Delete Organisation User Follower Relationship (Unfollow)


**Operation ID:** `org-users-follower-delete`


**Tags:** `Org users` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/users/{userId}/following`

### GET /api/v1/users/{userId}/following

> **Organisation User Following - List**


List Organisation User Following


**Operation ID:** `org-users-following-list`


**Tags:** `Org users` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/users/{userId}/isFollowing/{followerId}`

### GET /api/v1/users/{userId}/isFollowing/{followerId}

> **Organisation User IsFollowing**


Check if Organisation User is following someone


**Operation ID:** `org-users-is-following`


**Tags:** `Org users` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/users/{userId}/generate-reset-url`

### POST /api/v1/users/{userId}/generate-reset-url

> **Generate Organisation User Password Reset Token**


Generate Password Reset Token for Organisation User. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `org-users-generate-password-reset-token`


**Tags:** `Org Users` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/projects/{baseId}/users`

### GET /api/v1/db/meta/projects/{baseId}/users

> **List Base Users**


List all users in the given base.


**Operation ID:** `auth-base-user-list`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### POST /api/v1/db/meta/projects/{baseId}/users

> **Create Base User**


Create a user and add it to the given base


**Operation ID:** `auth-base-user-add`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/projects/{baseId}/info`

### GET /api/v1/db/meta/projects/{baseId}/info

> **Get Base info**


Get info such as node version, arch, platform, is docker, rootdb and package version of a given base


**Operation ID:** `base-meta-get`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/projects/{baseId}/users/{userId}`

### PATCH /api/v1/db/meta/projects/{baseId}/users/{userId}

> **Update Base User**


Update a given user in a given base. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `auth-base-user-update`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### DELETE /api/v1/db/meta/projects/{baseId}/users/{userId}

> **Delete Base User**


Delete a given user in a given base. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `auth-base-user-remove`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/projects/{baseId}/visibility-rules`

### GET /api/v1/db/meta/projects/{baseId}/visibility-rules

> **Get UI ACL**


Hide / show views based on user role


**Operation ID:** `base-model-visibility-list`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `includeM2M` | **query** |  (boolean) | ❌ No | - |
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### POST /api/v1/db/meta/projects/{baseId}/visibility-rules

> **Create UI ACL**


Hide / show views based on user role


**Operation ID:** `base-model-visibility-set`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/projects/`

### GET /api/v1/db/meta/projects/

> **List Projects**


List all base meta data


**Operation ID:** `base-list`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### POST /api/v1/db/meta/projects/

> **Create Base**


Create a new base


**Operation ID:** `base-create`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/duplicate/{baseId}/{sourceId}`

### POST /api/v1/db/meta/duplicate/{baseId}/{sourceId}

> **Duplicate Base Source**


Duplicate a base


**Operation ID:** `base-source-duplicate`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |
| `baseId` | **path** |  (string) | ✅ Yes | Unique Base ID |
| `sourceId` | **path** |  (string) | ❌ No | Unique Source ID |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/duplicate/{baseId}`

### POST /api/v1/db/meta/duplicate/{baseId}

> **Duplicate Base**


Duplicate a base


**Operation ID:** `base-duplicate`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |
| `baseId` | **path** |  (string) | ✅ Yes | Unique Base ID |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/projects/{baseId}`

### GET /api/v1/db/meta/projects/{baseId}

> **Get Base**


Get the info of a given base


**Operation ID:** `base-read`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### DELETE /api/v1/db/meta/projects/{baseId}

> **Delete Base**


Delete the given base


**Operation ID:** `base-delete`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### PATCH /api/v1/db/meta/projects/{baseId}

> **Update Base**


Update the given base


**Operation ID:** `base-update`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/projects/{baseId}/user`

### PATCH /api/v1/db/meta/projects/{baseId}/user

> **Base user meta update**


**Operation ID:** `base-user-meta-update`


**Tags:** `Base` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/meta/projects/{baseId}/bases/{sourceId}`

### GET /api/v1/db/meta/projects/{baseId}/bases/{sourceId}

> **Get Source**


Get the source details of a given base


**Operation ID:** `source-read`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### DELETE /api/v1/db/meta/projects/{baseId}/bases/{sourceId}

> **Delete Source**


Delete the source details of a given base


**Operation ID:** `source-delete`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### PATCH /api/v1/db/meta/projects/{baseId}/bases/{sourceId}

> **Update Source**


Update the source details of a given base


**Operation ID:** `source-update`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `/api/v1/db/meta/projects/{baseId}/bases/`

### GET /api/v1/db/meta/projects/{baseId}/bases/

> **List Sources**


Get base source list


**Operation ID:** `source-list`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
### POST /api/v1/db/meta/projects/{baseId}/bases/

> **Create Source**


Create a new source on a given base


**Operation ID:** `source-create`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/bases/{sourceId}/share/erd`

### POST /api/v1/db/meta/projects/{baseId}/bases/{sourceId}/share/erd

> **share ERD view**


**Operation ID:** `source-share-erd`


**Tags:** `Source` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### DELETE /api/v1/db/meta/projects/{baseId}/bases/{sourceId}/share/erd



**Operation ID:** `source-disable-share-erd`


**Tags:** `Source` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/meta/projects/{baseId}/shared`

### GET /api/v1/db/meta/projects/{baseId}/shared

> **Get Base Shared Base**


Get Base Shared Base


**Operation ID:** `base-shared-base-get`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/projects/{baseId}/shared

> **Delete Base Shared Base**


Delete Base Shared Base


**Operation ID:** `base-shared-base-disable`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/projects/{baseId}/shared

> **Create Base Shared Base**


Create Base Shared Base


**Operation ID:** `base-shared-base-create`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v1/db/meta/projects/{baseId}/shared

> **Update Base Shared Base**


Update Base Shared Base


**Operation ID:** `base-shared-base-update`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/cost`

### GET /api/v1/db/meta/projects/{baseId}/cost

> **Base Cost**


Calculate the Base Cost


**Operation ID:** `base-cost`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/tables`

### POST /api/v1/db/meta/projects/{baseId}/tables

> **Create Table**


Create a new table in a given base


**Operation ID:** `db-table-create`


**Tags:** `DB Table` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/projects/{baseId}/tables

> **List Tables**


List all tables in a given base


**Operation ID:** `db-table-list`


**Tags:** `DB Table` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `page` | **query** |  (number) | ❌ No | - |
| `pageSize` | **query** |  (number) | ❌ No | - |
| `sort` | **query** |  (string) | ❌ No | - |
| `includeM2M` | **query** |  (boolean) | ❌ No | - |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | Example response |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/internal/links/{linkColumnId}/tables/{tableId}`

### GET /api/v1/db/internal/links/{linkColumnId}/tables/{tableId}

> **Read Partial Linked Table**


Read the table metadata by linked column ID and  table ID


**Operation ID:** `db-links-table-read`


**Tags:** `DB Links` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}`

### GET /api/v1/db/meta/tables/{tableId}

> **Read Table**


Read the table meta data by the given table ID


**Operation ID:** `db-table-read`


**Tags:** `DB Table` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v1/db/meta/tables/{tableId}

> **Update Table**


Update the table meta data by the given table ID


**Operation ID:** `db-table-update`


**Tags:** `DB Table` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/tables/{tableId}

> **Delete Table**


Delete the table meta data by the given table ID


**Operation ID:** `db-table-delete`


**Tags:** `DB Table` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/duplicate/{baseId}/table/{tableId}`

### POST /api/v1/db/meta/duplicate/{baseId}/table/{tableId}

> **Duplicate Table**


Duplicate a table


**Operation ID:** `db-table-duplicate`


**Tags:** `DB Table` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `baseId` | **path** |  (string) | ✅ Yes | Unique Base ID |
| `tableId` | **path** |  (string) | ✅ Yes | Unique Table ID |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/duplicate/{baseId}/column/{columnId}`

### POST /api/v1/db/meta/duplicate/{baseId}/column/{columnId}

> **Duplicate Column**


Duplicate a column


**Operation ID:** `duplicate-column`


**Tags:** `DB Table` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `baseId` | **path** |  (string) | ✅ Yes | Unique Base ID |
| `columnId` | **path** |  (string) | ✅ Yes | Unique Column ID |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/meta/duplicate/{workspaceId}/shared/{sharedBaseId}`

### POST /api/v2/meta/duplicate/{workspaceId}/shared/{sharedBaseId}

> **Duplicate Shared Base**


Duplicate a shared base


**Operation ID:** `base-duplicate-shared`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `workspaceId` | **path** |  (string) | ✅ Yes | Unique Workspace ID |
| `sharedBaseId` | **path** |  | ✅ Yes | Unique Shared Base ID |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/{sourceId}/tables`

### GET /api/v1/db/meta/projects/{baseId}/{sourceId}/tables

> **List Tables**


List all tables in a given Base and Source


**Operation ID:** `table-list`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `page` | **query** |  (number) | ❌ No | - |
| `pageSize` | **query** |  (number) | ❌ No | - |
| `sort` | **query** |  (string) | ❌ No | - |
| `includeM2M` | **query** |  (boolean) | ❌ No | - |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | [Circular ref: #/components/responses/TableList] |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/projects/{baseId}/{sourceId}/tables

> **Create Table**


Create a new table in a given Base and Source


**Operation ID:** `table-create`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/reorder`

### POST /api/v1/db/meta/tables/{tableId}/reorder

> **Reorder Table**


Update the order of the given Table


**Operation ID:** `db-table-reorder`


**Tags:** `DB Table` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/columns`

### POST /api/v1/db/meta/tables/{tableId}/columns

> **Create Column**


Create a new column in a given Table


**Operation ID:** `db-table-column-create`


**Tags:** `DB Table Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/columns/{columnId}`

### PATCH /api/v1/db/meta/columns/{columnId}

> **Update Column**


Update the existing column by the given column ID


**Operation ID:** `db-table-column-update`


**Tags:** `DB Table Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/columns/{columnId}

> **Delete Column**


Delete the existing column by the given column ID


**Operation ID:** `db-table-column-delete`


**Tags:** `DB Table Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/columns/{columnId}

> **Get Column**


Get the existing column by the given column ID


**Operation ID:** `db-table-column-get`


**Tags:** `DB Table Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/columns/{columnId}/primary`

### POST /api/v1/db/meta/columns/{columnId}/primary

> **Create Primary Value**


Set a primary value on a given column


**Operation ID:** `db-table-column-primary-column-set`


**Tags:** `DB Table Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/views`

### GET /api/v1/db/meta/tables/{tableId}/views

> **List Views**


List all views in a given Table.


**Operation ID:** `db-view-list`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}`

### PATCH /api/v1/db/meta/views/{viewId}

> **Update View**


Update the view with the given view Id.


**Operation ID:** `db-view-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/views/{viewId}

> **Delete View**


Delete the view with the given view Id.


**Operation ID:** `db-view-delete`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}/row-color`

### GET /api/v1/db/meta/views/{viewId}/row-color

> **Get row color info**


Get the row color info from view.


**Operation ID:** `get-view-row-color`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/views/{viewId}/row-color

> **Delete row color info**


Delete the row color info from view.


**Operation ID:** `delete-view-row-color`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}/row-color-select`

### POST /api/v1/db/meta/views/{viewId}/row-color-select

> **Set view row color select**


**Operation ID:** `view-row-color-select-add`


**Tags:** `DB View` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/meta/views/{viewId}/row-color-conditions`

### POST /api/v1/db/meta/views/{viewId}/row-color-conditions

> **Add view row color condition**


**Operation ID:** `view-row-color-condition-add`


**Tags:** `DB View` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/meta/views/{viewId}/row-color-conditions/{id}`

### PATCH /api/v1/db/meta/views/{viewId}/row-color-conditions/{id}

> **Update view row color condition**


**Operation ID:** `view-row-color-condition-update`


**Tags:** `DB View` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### DELETE /api/v1/db/meta/views/{viewId}/row-color-conditions/{id}

> **Delete view row color condition**


**Operation ID:** `view-row-color-condition-delete`


**Tags:** `DB View` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/meta/views/{viewId}/show-all`

### POST /api/v1/db/meta/views/{viewId}/show-all

> **Show All Columns In View**


Show All Columns in a given View


**Operation ID:** `db-view-show-all-column`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `ignoreIds` | **query** |  (array) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}/hide-all`

### POST /api/v1/db/meta/views/{viewId}/hide-all

> **Hide All Columns In View**


Hide All Columns in a given View


**Operation ID:** `db-view-hide-all-column`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `ignoreIds` | **query** |  (array) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/share`

### GET /api/v1/db/meta/tables/{tableId}/share

> **List Shared Views**


List all shared views in a given Table


**Operation ID:** `db-view-share-list`


**Tags:** `DB View Share` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}/share`

### POST /api/v1/db/meta/views/{viewId}/share

> **Create Shared View**


Create a shared view in a given View..


**Operation ID:** `db-view-share-create`


**Tags:** `DB View Share` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v1/db/meta/views/{viewId}/share

> **Update Shared View**


Update a shared view in a given View..


**Operation ID:** `db-view-share-update`


**Tags:** `DB View Share` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/views/{viewId}/share

> **Delete Shared View**


Delete a shared view in a given View.


**Operation ID:** `db-view-share-delete`


**Tags:** `DB View Share` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}/columns`

### GET /api/v1/db/meta/views/{viewId}/columns

> **List Columns In View**


List all columns by ViewID


**Operation ID:** `db-view-column-list`


**Tags:** `DB View Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/views/{viewId}/columns

> **Create Column in View**


Create a new column in a given View


**Operation ID:** `db-view-column-create`


**Tags:** `DB View Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}/columns/{columnId}`

### PATCH /api/v1/db/meta/views/{viewId}/columns/{columnId}

> **Update View Column**


Update a column in a View


**Operation ID:** `db-view-column-update`


**Tags:** `DB View Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}/sorts`

### GET /api/v1/db/meta/views/{viewId}/sorts

> **List View Sorts**


List all the sort data in a given View


**Operation ID:** `db-table-sort-list`


**Tags:** `DB Table Sort` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/views/{viewId}/sorts

> **Update View Sort**


Update the sort data in a given View


**Operation ID:** `db-table-sort-create`


**Tags:** `DB Table Sort` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/sorts/{sortId}`

### GET /api/v1/db/meta/sorts/{sortId}

> **Get Sort**


Get the sort data by Sort ID


**Operation ID:** `db-table-sort-get`


**Tags:** `DB Table Sort` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v1/db/meta/sorts/{sortId}

> **Update Sort**


Update the sort data by Sort ID


**Operation ID:** `db-table-sort-update`


**Tags:** `DB Table Sort` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/sorts/{sortId}

> **Delete Sort**


Delete the sort data by Sort ID


**Operation ID:** `db-table-sort-delete`


**Tags:** `DB Table Sort` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/views/{viewId}/filters`

### GET /api/v1/db/meta/views/{viewId}/filters

> **Get View Filter**


Get the filter data in a given View


**Operation ID:** `db-table-filter-read`


**Tags:** `DB Table Filter` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `includeAllFilters` | **query** |  (boolean) | ❌ No | - |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/views/{viewId}/filters

> **Create View Filter**


Update the filter data in a given View


**Operation ID:** `db-table-filter-create`


**Tags:** `DB Table Filter` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/hooks/{hookId}/filters`

### GET /api/v1/db/meta/hooks/{hookId}/filters

> **Get Hook Filter**


Get the filter data in a given Hook


**Operation ID:** `db-table-webhook-filter-read`


**Tags:** `DB Table Webhook Filter` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/hooks/{hookId}/filters

> **Create Hook Filter**


Create filter(s) in a given Hook


**Operation ID:** `db-table-webhook-filter-create`


**Tags:** `DB Table Webhook Filter` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/hooks/{hookId}/logs`

### GET /api/v1/db/meta/hooks/{hookId}/logs

> **List Hook Logs**


List the log data in a given Hook


**Operation ID:** `db-table-webhook-logs-list`


**Tags:** `DB Table Webhook Logs` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/filters/{filterId}`

### GET /api/v1/db/meta/filters/{filterId}

> **Get Filter**


Get the filter data with a given Filter ID


**Operation ID:** `db-table-filter-get`


**Tags:** `DB Table Filter` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v1/db/meta/filters/{filterId}

> **Update Filter**


Update the filter data with a given Filter ID


**Operation ID:** `db-table-filter-update`


**Tags:** `DB Table Filter` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/filters/{filterId}

> **Delete Filter**


Delete the filter data with a given Filter ID


**Operation ID:** `db-table-filter-delete`


**Tags:** `DB Table Filter` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/filters/{filterGroupId}/children`

### GET /api/v1/db/meta/filters/{filterGroupId}/children

> **Get Filter Group Children**


Get Filter Group Children of a given group ID


**Operation ID:** `db-table-filter-children-read`


**Tags:** `DB Table Filter` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/grids`

### POST /api/v1/db/meta/tables/{tableId}/grids

> **Create Grid View**


Create a new grid view in a given Table


**Operation ID:** `db-view-grid-create`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/forms`

### POST /api/v1/db/meta/tables/{tableId}/forms

> **Create Form View**


Create a new form view in a given Table


**Operation ID:** `db-view-form-create`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/forms/{formViewId}`

### PATCH /api/v1/db/meta/forms/{formViewId}

> **Update Form View**


Update the form data by Form ID


**Operation ID:** `db-view-form-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/forms/{formViewId}

> **Get Form**


Get the form data by Form ID


**Operation ID:** `db-view-form-read`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/form-columns/{formViewColumnId}`

### PATCH /api/v1/db/meta/form-columns/{formViewColumnId}

> **Update Form Column**


Update the form column(s) by Form View Column ID


**Operation ID:** `db-view-form-column-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/grids/{viewId}`

### PATCH /api/v1/db/meta/grids/{viewId}

> **Update Grid View**


Update Grid View


**Operation ID:** `db-view-grid-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/grids/{gridId}/grid-columns`

### GET /api/v1/db/meta/grids/{gridId}/grid-columns

> **List Grid Columns**


List all columns in the given Grid


**Operation ID:** `db-view-grid-columns-list`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/grid-columns/{columnId}`

### PATCH /api/v1/db/meta/grid-columns/{columnId}

> **Update Grid Column**


Update grid column(s) in the given Grid


**Operation ID:** `db-view-grid-column-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/galleries`

### POST /api/v1/db/meta/tables/{tableId}/galleries

> **Create Gallery View**


**Operation ID:** `db-view-gallery-create`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/galleries/{galleryViewId}`

### PATCH /api/v1/db/meta/galleries/{galleryViewId}

> **Update Gallery View**


Update the Gallery View data with Gallery ID


**Operation ID:** `db-view-gallery-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/galleries/{galleryViewId}

> **Get Gallery View**


Get the Gallery View data with Gallery ID


**Operation ID:** `db-view-gallery-read`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/kanbans`

### POST /api/v1/db/meta/tables/{tableId}/kanbans

> **Create Kanban View**


Create a new Kanban View


**Operation ID:** `db-view-kanban-create`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/kanbans/{kanbanViewId}`

### PATCH /api/v1/db/meta/kanbans/{kanbanViewId}

> **Update Kanban View**


Update the Kanban View data with Kanban ID


**Operation ID:** `db-view-kanban-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/kanbans/{kanbanViewId}

> **Get Kanban View**


Get the Kanban View data by Kanban ID


**Operation ID:** `db-view-kanban-read`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/maps`

### POST /api/v1/db/meta/tables/{tableId}/maps

> **Create Map View**


Create a new Map View


**Operation ID:** `db-view-map-create`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/maps/{mapViewId}`

### PATCH /api/v1/db/meta/maps/{mapViewId}

> **Update Map View**


Update the Map View data by Map ID


**Operation ID:** `db-view-map-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/maps/{mapViewId}

> **Get Map View**


Get the Map View data by Map ID


**Operation ID:** `db-view-map-read`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/calendars`

### POST /api/v1/db/meta/tables/{tableId}/calendars

> **Create Calendar View**


Create a new Calendar View


**Operation ID:** `db-view-calendar-create`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/calendars/{calendarViewId}`

### PATCH /api/v1/db/meta/calendars/{calendarViewId}

> **Update Calendar View**


Update the Calendar View data with Calendar ID


**Operation ID:** `db-view-calendar-update`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/calendars/{calendarViewId}

> **Get Calendar View**


Get the Calendar View data by Calendar ID


**Operation ID:** `db-view-calendar-read`


**Tags:** `DB View` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/meta-diff`

### POST /api/v1/db/meta/projects/{baseId}/meta-diff

> **Sync Meta**


Synchronise the meta data difference between NC_DB and external data sources 


**Operation ID:** `base-meta-diff-sync`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/projects/{baseId}/meta-diff

> **Meta Diff**


Get the meta data difference between NC_DB and external data sources 


**Operation ID:** `base-meta-diff-get`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}`

### POST /api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}

> **Synchronise Source Meta**


Synchronise the meta data difference between NC_DB and external data sources in a given Source


**Operation ID:** `source-meta-diff-sync`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}

> **Source Meta Diff**


Get the meta data difference between NC_DB and external data sources in a given Source


**Operation ID:** `source-meta-diff-get`


**Tags:** `Source` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/has-empty-or-null-filters`

### GET /api/v1/db/meta/projects/{baseId}/has-empty-or-null-filters

> **List Empty &amp; Null Filter**


Check if a base contains empty and null filters. Used in &#x60;Show NULL and EMPTY in Filter&#x60; in Base Setting.


**Operation ID:** `base-has-empty-or-null-filters`


**Tags:** `Base` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}

> **List Table Rows**


List all table rows in a given table and base


**Operation ID:** `db-table-row-list`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `pks` | **query** |  (string) | ❌ No | Comma separated list of pks |
| `getHiddenColumns` | **query** |  (string) | ❌ No | Get hidden columns on List Api |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/data/{orgs}/{baseName}/{tableName}

> **Create Table Row**


Create a new row in a given table and base.


**Operation ID:** `db-table-row-create`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `before` | **query** |  (string) | ❌ No | - |
| `undo` | **query** |  (boolean) | ❌ No | - |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/find-one`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/find-one

> **Find One Table Row**


Return the first result of the target Table Row


**Operation ID:** `db-table-row-find-one`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/groupby`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/groupby

> **Group By Table Row**


Get the result grouped by the given query


**Operation ID:** `db-table-row-group-by`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/groupby/count`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/groupby/count

> **Group By Table Row Count**


Get the number of groups by the given query


**Operation ID:** `db-table-row-group-by-count`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/group/{columnId}`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/group/{columnId}

> **Table Group by Column**


Get the grouped data By Column ID. Used in Kanban View.


**Operation ID:** `db-view-row-grouped-data-list`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/group/{columnId}`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/group/{columnId}

> **Table Group by Column**


Get the grouped data By Column ID. Used in Kanban View.


**Operation ID:** `db-table-row-grouped-data-list`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}`

### GET /api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}

> **List rows in Calendar View of a Table**


List all rows in Calendar View of a Table


**Operation ID:** `db-calendar-view-row-list`


**Tags:** `DB Calendar View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `from_date` | **query** |  (string) | ✅ Yes | - |
| `prev_date` | **query** |  (string) | ✅ Yes | - |
| `next_date` | **query** |  (string) | ✅ Yes | - |
| `to_date` | **query** |  (string) | ✅ Yes | - |
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `offset` | **query** |  (number) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |




---
## `/api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}/countByDate/`

### GET /api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}/countByDate/

> **Count of Records in Dates in Calendar View**


Get the count of table view rows grouped by the dates


**Operation ID:** `db-calendar-view-row-count`


**Tags:** `DB Calendar View Row Count` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `from_date` | **query** |  (string) | ✅ Yes | - |
| `to_date` | **query** |  (string) | ✅ Yes | - |
| `prev_date` | **query** |  (string) | ✅ Yes | - |
| `next_date` | **query** |  (string) | ✅ Yes | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/calendar-view/{sharedViewUuid}`

### GET /api/v1/db/public/calendar-view/{sharedViewUuid}

> **List rows in Calendar View of a Table**


List all rows in Calendar View of a Table


**Operation ID:** `public-data-calendar-row-list`


**Tags:** `DB Calendar View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `from_date` | **query** |  (string) | ✅ Yes | - |
| `to_date` | **query** |  (string) | ✅ Yes | - |
| `prev_date` | **query** |  (string) | ✅ Yes | - |
| `next_date` | **query** |  (string) | ✅ Yes | - |
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `offset` | **query** |  (number) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |




---
## `/api/v1/db/public/calendar-view/{sharedViewUuid}/countByDate`

### GET /api/v1/db/public/calendar-view/{sharedViewUuid}/countByDate

> **Count of Records in Dates in Calendar View**


**Operation ID:** `public-data-calendar-row-count`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `from_date` | **query** |  (string) | ✅ Yes | - |
| `prev_date` | **query** |  (string) | ✅ Yes | - |
| `next_date` | **query** |  (string) | ✅ Yes | - |
| `to_date` | **query** |  (string) | ✅ Yes | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}

> **List Table View Rows**


List all table view rows


**Operation ID:** `db-view-row-list`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `offset` | **query** |  (number) | ❌ No | - |
| `getHiddenColumns` | **query** |  (boolean) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}

> **Create Table View Row**


Create a new row in the given Table View


**Operation ID:** `db-view-row-create`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `before` | **query** |  (string) | ❌ No | - |
| `undo` | **query** |  (string) | ❌ No | - |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/find-one`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/find-one

> **Find One Table View Row**


Return the first result of table view rows with the given query


**Operation ID:** `db-view-row-find-one`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/groupby`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/groupby

> **Group By Table View Row**


Get the table view rows grouped by the given query


**Operation ID:** `db-view-row-group-by`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/groupby/count`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/groupby/count

> **Count of Group By Table View Row **


Get the table view rows grouped by count the given query


**Operation ID:** `db-view-row-group-by-count`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/count`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/count

> **Count Table View Rows**


Count how many rows in the given Table View


**Operation ID:** `db-view-row-count`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}

> **Get Table View Row**


Get the target Table View Row


**Operation ID:** `db-view-row-read`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}

> **Update Table View Row**


Update the target Table View Row


**Operation ID:** `db-view-row-update`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}

> **Delete Table View Row**


Delete the target Table View Row


**Operation ID:** `db-view-row-delete`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}/exist`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}/exist

> **Does Table View Row Exist**


Check row with provided primary key exists or not


**Operation ID:** `db-view-row-exist`


**Tags:** `DB View Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **201** | Created |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}

> **Get Table Row**


Get the Table Row by Row ID


**Operation ID:** `db-table-row-read`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}

> **Update Table Row**


Update the Table Row


**Operation ID:** `db-table-row-update`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}

> **Delete Table Row**


Delete the Table Row


**Operation ID:** `db-table-row-delete`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/exist`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/exist

> **Does Table Row Exist**


check row with provided primary key exists or not


**Operation ID:** `db-table-row-exist`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/bulk/dataList`

### POST /api/v2/tables/{tableId}/bulk/dataList

> **Read Bulk Data**


Read bulk data from a given table with given filters


**Operation ID:** `db-data-table-bulk-list`


**Tags:** `DB Data Table Bulk List` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `where` | **query** |  (string) | ❌ No | Extra filtering |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/bulk/group`

### POST /api/v2/tables/{tableId}/bulk/group

> **Read Bulk Group Data**


Read bulk group data from a given table with given filters


**Operation ID:** `db-data-table-bulk-group-list`


**Tags:** `DB Data Table Bulk Group List` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/upsert`

### POST /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/upsert

> **Bulk Upsert Table Rows**


Bulk upsert table rows in one go.


**Operation ID:** `db-table-row-bulk-upsert`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}`

### POST /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}

> **Bulk Insert Table Rows**


Bulk insert table rows in one go.


**Operation ID:** `db-table-row-bulk-create`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `undo` | **query** |  (string) | ❌ No | - |
| `nc-operation-id` | **header** |  (string) | ❌ No | Operation ID |
| `nc-import-type` | **header** |  (string) | ❌ No | Import Type if triggering from import |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}

> **Bulk Update Table Rows by IDs**


Bulk Update Table Rows by given IDs


**Operation ID:** `db-table-row-bulk-update`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}

> **Bulk Delete Table Rows by IDs**


Bulk Delete Table Rows by given IDs


**Operation ID:** `db-table-row-bulk-delete`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/all`

### PATCH /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/all

> **Bulk Update Table Rows with Conditions**


Bulk Update all Table Rows if the condition is true


**Operation ID:** `db-table-row-bulk-update-all`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/all

> **Bulk Delete Table Rows with Conditions**


Bulk Delete all Table Rows if the condition is true


**Operation ID:** `db-table-row-bulk-delete-all`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}

> **List Nested Relations Rows**


List all nested relations rows


**Operation ID:** `db-table-row-nested-list`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}`

### POST /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}

> **Create Nested Relations Row**


Create a new nested relations row


**Operation ID:** `db-table-row-nested-add`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}

> **Delete Nested Relations Row**


Delete a new nested relations row


**Operation ID:** `db-table-row-nested-remove`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/exclude`

### GET /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/exclude

> **Referenced Table Rows Excluding Current Record&#x27;s Children / Parent**


Get the table rows but exculding the current record&#x27;s children and parent


**Operation ID:** `db-table-row-nested-children-excluded-list`


**Tags:** `DB Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/public/shared-view/{sharedViewUuid}/count`

### GET /api/v2/public/shared-view/{sharedViewUuid}/count

> **Count Table View Rows**


Count how many rows in the given Table View


**Operation ID:** `public-db-view-row-count`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/public/oauth/client/{clientId}`

### GET /api/v2/public/oauth/client/{clientId}

> **Get OAuth Client Information**


Retrieve public information about an OAuth client for authorization display



**Tags:** `OAuth` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OAuth client information |
| **400** | Invalid client ID format |
| **404** | OAuth client not found |


---
## `/api/v2/oauth/authorize`

### POST /api/v2/oauth/authorize

> **OAuth Authorization**


Handle OAuth authorization request with user approval/denial


**Operation ID:** `authorize`


**Tags:** `OAuth` 



#### Request Body

- **Required:** Yes

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | Authorization processed successfully |
| **400** | Missing required parameters |


---
## `/api/v2/public/shared-view/{sharedViewUuid}/bulk/dataList`

### POST /api/v2/public/shared-view/{sharedViewUuid}/bulk/dataList

> **Read Shared View Bulk Data List**


Read bulk data from a given table with provided filters


**Operation ID:** `public-data-table-bulk-data-list`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/public/shared-view/{sharedViewUuid}/bulk/group`

### POST /api/v2/public/shared-view/{sharedViewUuid}/bulk/group

> **Read Shared View Bulk Group Data**


Read bulk group data from a given table with provided filters


**Operation ID:** `public-data-table-bulk-group`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/public/shared-view/{sharedViewUuid}/aggregate`

### GET /api/v2/public/shared-view/{sharedViewUuid}/aggregate

> **Read Shared View Aggregated Data**


Read aggregated data from a given table


**Operation ID:** `public-data-table-aggregate`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `aggregation` | **query** |  (array) | ❌ No | Used for selective aggregation |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/bulk/aggregate`

### POST /api/v2/tables/{tableId}/bulk/aggregate

> **Read Bulk Aggregated Data**


Read bulk aggregated data from a given table with given filters


**Operation ID:** `db-data-table-bulk-aggregate`


**Tags:** `DB Data Table Bulk Aggregate` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/public/shared-view/{sharedViewUuid}/bulk/aggregate`

### POST /api/v2/public/shared-view/{sharedViewUuid}/bulk/aggregate

> **Read Shared View Bulk Aggregated Data**


Read bulk aggregated data from a given table with provided filters


**Operation ID:** `public-data-table-bulk-aggregate`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `aggregation` | **query** |  (array) | ❌ No | Used for selective aggregation |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/public/shared-view/{sharedViewUuid}/downloadAttachment/{columnId}/{rowId}`

### GET /api/v2/public/shared-view/{sharedViewUuid}/downloadAttachment/{columnId}/{rowId}

> **Get Shared View Attachment**


Download attachment from a shared view


**Operation ID:** `public-data-attachment-download`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `urlOrPath` | **query** |  (string) | ❌ No | URL or Path of the attachment |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/shared-view/{sharedViewUuid}/group/{columnId}`

### GET /api/v1/db/public/shared-view/{sharedViewUuid}/group/{columnId}

> **List Shared View Grouped Data**


List Shared View Grouped Data


**Operation ID:** `public-grouped-data-list`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/shared-view/{sharedViewUuid}/rows`

### GET /api/v1/db/public/shared-view/{sharedViewUuid}/rows

> **List Shared View Rows**


List all shared view rows


**Operation ID:** `public-data-list`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `pks` | **query** |  (string) | ❌ No | Comma separated list of pks |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/public/shared-view/{sharedViewUuid}/rows

> **Create Share View Row**


Create a new row for the target shared view


**Operation ID:** `public-data-create`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-password` | **header** |  (string) | ❌ No | Shared view password |


#### Request Body

- **Required:** No

- **Content-Type:** `multipart/form-data`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/shared-view/{sharedViewUuid}/groupby`

### GET /api/v1/db/public/shared-view/{sharedViewUuid}/groupby

> **List Shared View Rows**


List all shared view rows grouped by a column


**Operation ID:** `public-data-group-by`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `column_name` | **query** |  (string) | ❌ No | Columns to group by |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/public/shared-view/{sharedViewUuid}/groupby/count`

### GET /api/v2/public/shared-view/{sharedViewUuid}/groupby/count

> **Group By Table Row Count**


Get the number of groups by the given query


**Operation ID:** `public-data-group-by-count`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `column_name` | **query** |  (string) | ❌ No | Columns to group by |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/shared-view/{sharedViewUuid}/rows/{rowId}/{relationType}/{columnName}`

### GET /api/v1/db/public/shared-view/{sharedViewUuid}/rows/{rowId}/{relationType}/{columnName}

> **List Nested List Data**


List all nested list data in a given shared view


**Operation ID:** `public-data-nested-list`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/shared-view/{sharedViewUuid}/nested/{columnName}`

### GET /api/v1/db/public/shared-view/{sharedViewUuid}/nested/{columnName}

> **List Nested Data Relation**


List Nested Data Relation


**Operation ID:** `public-data-relation-list`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/shared-base/{sharedBaseUuid}/meta`

### GET /api/v1/db/public/shared-base/{sharedBaseUuid}/meta

> **Get Share Source Meta**


Get Share Source Meta


**Operation ID:** `public-shared-base-get`


**Tags:** `Public` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/shared-view/{sharedViewUuid}/meta`

### GET /api/v1/db/public/shared-view/{sharedViewUuid}/meta

> **Get Share View Meta**


Get Share View Meta


**Operation ID:** `public-shared-view-meta-get`


**Tags:** `Public` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/public/shared-erd/{sharedErdUuid}/meta`

### GET /api/v1/db/public/shared-erd/{sharedErdUuid}/meta



**Operation ID:** `public-shared-erd-meta-get`


**Tags:** `Public` 





---
## `/api/v1/db/meta/comments`

### GET /api/v1/db/meta/comments

> **List Comments**


List all comments


**Operation ID:** `utils-comment-list`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `row_id` | **query** |  (string) | ✅ Yes | Row ID |
| `fk_model_id` | **query** |  | ✅ Yes | Foreign Key to Model |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/comments

> **Comment Rows**


Create a new comment in a row.


**Operation ID:** `utils-comment-row`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/comment/{commentId}/`

### PATCH /api/v1/db/meta/comment/{commentId}/

> **Update Comment**


Update comment


**Operation ID:** `utils-comment-update`


**Tags:** `Utils` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### DELETE /api/v1/db/meta/comment/{commentId}/

> **Delete Comment**


Delete comment


**Operation ID:** `utils-comment-delete`


**Tags:** `Utils` 



#### Request Body

- **Required:** No



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/meta/comments/count`

### GET /api/v1/db/meta/comments/count

> **Count Comments**


Return the number of comments in the given query.


**Operation ID:** `utils-comment-count`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `ids` | **query** |  | ✅ Yes | Comment IDs |
| `fk_model_id` | **query** |  | ✅ Yes | Foreign Key to Model |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/hooks`

### GET /api/v1/db/meta/tables/{tableId}/hooks

> **List Table Hooks**


List all hook records in the given Table


**Operation ID:** `db-table-webhook-list`


**Tags:** `DB Table Webhook` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/tables/{tableId}/hooks

> **Create Table Hook**


Create a hook in the given table


**Operation ID:** `db-table-webhook-create`


**Tags:** `DB Table Webhook` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/hooks/test`

### POST /api/v1/db/meta/tables/{tableId}/hooks/test

> **Test Hook**


Test the hook in the given Table


**Operation ID:** `db-table-webhook-test`


**Tags:** `DB Table Webhook` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{event}/{operation}/{version}`

### GET /api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{event}/{operation}/{version}

> **Get Sample Hook Payload**


Get the sample hook payload


**Operation ID:** `db-table-webhook-sample-payload-get`


**Tags:** `DB Table Webhook` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/hooks/{hookId}`

### PATCH /api/v1/db/meta/hooks/{hookId}

> **Update Hook**


Update the exsiting hook by its ID


**Operation ID:** `db-table-webhook-update`


**Tags:** `DB Table Webhook` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v1/db/meta/hooks/{hookId}

> **Delete Hook**


Delete the exsiting hook by its ID


**Operation ID:** `db-table-webhook-delete`


**Tags:** `DB Table Webhook` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/plugins`

### GET /api/v1/db/meta/plugins

> **List Plugins**


List all plugins


**Operation ID:** `plugin-list`


**Tags:** `Plugin` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/plugins/webhook`

### GET /api/v1/db/meta/plugins/webhook

> **Webhook List Plugins**


List all webhook plugins


**Operation ID:** `plugin-webhook-list`


**Tags:** `Plugin` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/plugins/{pluginId}/status`

### GET /api/v1/db/meta/plugins/{pluginId}/status

> **Get Plugin Status**


Check plugin is active or not


**Operation ID:** `plugin-status`


**Tags:** `Plugin` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/plugins/test`

### POST /api/v1/db/meta/plugins/test

> **Test Plugin**


Test if the plugin is working with the given configurations


**Operation ID:** `plugin-test`


**Tags:** `Plugin` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/plugins/{pluginId}`

### PATCH /api/v1/db/meta/plugins/{pluginId}

> **Update Plugin**


Update the plugin data by ID


**Operation ID:** `plugin-update`


**Tags:** `Plugin` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### GET /api/v1/db/meta/plugins/{pluginId}

> **Get Plugin**


Get the plugin data by ID


**Operation ID:** `plugin-read`


**Tags:** `Plugin` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/connection/test`

### POST /api/v1/db/meta/connection/test

> **Test DB Connection**


Test the DB Connection


**Operation ID:** `utils-test-connection`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/url_to_config`

### POST /api/v1/url_to_config

> **Convert JDBC URL to Config**


Extract XC URL From JDBC and parse to connection config


**Operation ID:** `utils-url-to-config`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/nocodb/info`

### GET /api/v1/db/meta/nocodb/info

> **Get App Info**


Get the application info such as authType, defaultLimit, version and etc.


**Operation ID:** `utils-app-info`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/error-reporting`

### POST /api/v1/error-reporting

> **Error Reporting**


Error Reporting


**Operation ID:** `utils-error-report`


**Tags:** `Utils` `Internal` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`


#### Responses

| Status Code | Description |
|-------------|-------------|


---
## `/api/v1/db/meta/axiosRequestMake`

### POST /api/v1/db/meta/axiosRequestMake

> **Axios Request**


Generic Axios Call


**Operation ID:** `utils-axios-request-make`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/version`

### GET /api/v1/version

> **Get App Version**


Get the application version


**Operation ID:** `utils-app-version`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/health`

### GET /api/v1/health

> **Get Application Health Status**


Get Application Health Status


**Operation ID:** `utils-app-health`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/feed`

### GET /api/v2/feed

> **Get Feed**


**Operation ID:** `utils-feed`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `type` | **query** |  (string) | ❌ No | - |
| `per_page` | **query** |  (number) | ❌ No | - |
| `page` | **query** |  (number) | ❌ No | - |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/cloud-features`

### GET /api/v2/cloud-features

> **Get Cloud Features**


**Operation ID:** `utils-cloud-features`


**Tags:** `Utils` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/aggregated-meta-info`

### GET /api/v1/aggregated-meta-info

> **Get Aggregated Meta Info**


Get Aggregated Meta Info such as tableCount, dbViewCount, viewCount and etc.


**Operation ID:** `utils-aggregated-meta-info`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/cache`

### GET /api/v1/db/meta/cache

> **Get Cache**


Get All K/V pairs in NocoCache


**Operation ID:** `utils-cache-get`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|


---
### DELETE /api/v1/db/meta/cache

> **Delete Cache**


Delete All K/V pairs in NocoCache


**Operation ID:** `utils-cache-delete`


**Tags:** `Utils` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/api-tokens`

### GET /api/v1/db/meta/projects/{baseId}/api-tokens

> **List API Tokens in Base**


List API Tokens in the given base


**Operation ID:** `api-token-list`


**Tags:** `API Token` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v1/db/meta/projects/{baseId}/api-tokens

> **Create API Token**


Create API Token in a base


**Operation ID:** `api-token-create`


**Tags:** `API Token` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/meta/projects/{baseId}/api-tokens/{tokenId}`

### DELETE /api/v1/db/meta/projects/{baseId}/api-tokens/{tokenId}

> **Delete API Token**


Delete the given API Token in base


**Operation ID:** `api-token-delete`


**Tags:** `API Token` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/db/storage/upload`

### POST /api/v1/db/storage/upload

> **Attachment Upload**


Upload attachment


**Operation ID:** `storage-upload`


**Tags:** `Storage` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `path` | **query** |  (string) | ✅ Yes | Target File Path |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `scope` | **query** |  (string) | ❌ No | The scope of the attachment |


#### Request Body

- **Required:** No

- **Content-Type:** `multipart/form-data`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|


---
## `/api/v1/db/storage/upload-by-url`

### POST /api/v1/db/storage/upload-by-url

> **Attachment Upload by URL**


Upload attachment by URL. Used in Airtable Migration.


**Operation ID:** `storage-upload-by-url`


**Tags:** `Storage` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `path` | **query** |  (string) | ✅ Yes | Target File Path |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `scope` | **query** |  (string) | ❌ No | The scope of the attachment |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|


---
## `/api/v1/db/meta/projects/{baseId}/users/{userId}/resend-invite`

### POST /api/v1/db/meta/projects/{baseId}/users/{userId}/resend-invite

> **Resend User Invitation**


Resend Invitation to a specific user


**Operation ID:** `auth-base-user-resend-invite`


**Tags:** `Auth` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/notifications/poll`

### GET /api/v1/notifications/poll

> **Notification Poll**


Poll notifications


**Operation ID:** `notification-poll`


**Tags:** `Notification` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/notifications`

### GET /api/v1/notifications

> **Notification list**


List notifications


**Operation ID:** `notification-list`


**Tags:** `Notification` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `is_read` | **query** |  (boolean) | ❌ No | - |
| `limit` | **query** |  (number) | ❌ No | - |
| `offset` | **query** |  (number) | ❌ No | - |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/notifications/{notificationId}`

### PATCH /api/v1/notifications/{notificationId}

> **Notification update**


Notificattion update


**Operation ID:** `notification-update`


**Tags:** `Notification` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### DELETE /api/v1/notifications/{notificationId}

> **Delete notification**


Delete notification


**Operation ID:** `notification-delete`


**Tags:** `Notification` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/notifications/mark-all-read`

### POST /api/v1/notifications/mark-all-read

> **Mark all notifications as read**


Mark all notifications as read


**Operation ID:** `notification-mark-all-as-read`


**Tags:** `Notification` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/meta/tables/{tableId}/columns/hash`

### GET /api/v1/db/meta/tables/{tableId}/columns/hash

> **Get columns hash for table**


Get columns hash for table


**Operation ID:** `db-table-column-hash`


**Tags:** `DB Table Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/db/meta/tables/{tableId}/columns/bulk`

### POST /api/v1/db/meta/tables/{tableId}/columns/bulk

> **Bulk create-update-delete columns**


Bulk create-update-delete columns


**Operation ID:** `db-table-column-bulk`


**Tags:** `DB Table Column` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/aggregate`

### GET /api/v2/tables/{tableId}/aggregate

> **Read Aggregated Data**


Read aggregated data from a given table


**Operation ID:** `db-data-table-aggregate`


**Tags:** `DB Data Table Aggregate` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/records`

### GET /api/v2/tables/{tableId}/records

> **List Table Rows**


List all table rows in a given table


**Operation ID:** `db-data-table-row-list`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `pks` | **query** |  (string) | ❌ No | Comma separated list of pks |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v2/tables/{tableId}/records

> **Create Table Rows**


Create a new row in a given table and base.


**Operation ID:** `db-data-table-row-create`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `before` | **query** |  (string) | ❌ No | - |
| `undo` | **query** |  (string) | ❌ No | - |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### PATCH /api/v2/tables/{tableId}/records

> **Update Table Rows**


Create a new row in a given table and base.


**Operation ID:** `db-data-table-row-update`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v2/tables/{tableId}/records

> **Delete Table Rows**


Create a new row in a given table and base.


**Operation ID:** `db-data-table-row-delete`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/records/{rowId}`

### GET /api/v2/tables/{tableId}/records/{rowId}

> **Read Table Row**


Get table row in a given table


**Operation ID:** `db-data-table-row-read`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/records/{rowId}/move`

### POST /api/v2/tables/{tableId}/records/{rowId}/move

> **Move Table Row**


Move the table row to new position


**Operation ID:** `db-data-table-row-move`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `before` | **query** |  (string) | ❌ No | The row ID before which the row should be moved |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/records/count`

### GET /api/v2/tables/{tableId}/records/count

> **Table Rows Count**


Count of rows in a given table


**Operation ID:** `db-data-table-row-count`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/tables/{tableId}/links/{columnId}/records/{rowId}`

### GET /api/v2/tables/{tableId}/links/{columnId}/records/{rowId}

> **Get Nested Relations Rows**


Linked rows in a given Links/LinkToAnotherRecord column


**Operation ID:** `db-data-table-row-nested-list`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### POST /api/v2/tables/{tableId}/links/{columnId}/records/{rowId}

> **Create Nested Relations Rows**


Create a link with the row.


**Operation ID:** `db-data-table-row-nested-link`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
### DELETE /api/v2/tables/{tableId}/links/{columnId}/records/{rowId}

> **Delete Nested Relations Rows**


Create a new row in a given table and base.


**Operation ID:** `db-data-table-row-nested-unlink`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/downloadAttachment/{modelId}/{columnId}/{rowId}`

### GET /api/v2/downloadAttachment/{modelId}/{columnId}/{rowId}

> **Download Attachment**


Download attachment from a given row


**Operation ID:** `db-data-table-row-attachment-download`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/tables/{tableId}/links/{columnId}/records`

### POST /api/v2/tables/{tableId}/links/{columnId}/records

> **Copy paste or deleteAll nested link**


Copy links from the one cell and paste them into another cell or delete all records from cell


**Operation ID:** `db-data-table-row-nested-list-copy-paste-or-deleteAll`


**Tags:** `DB Data Table Row` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** Yes

- **Content-Type:** `application/json`
  - **Schema:** `array`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v1/command_palette`

### POST /api/v1/command_palette

> **Get command palette suggestions**


Get dynamic command palette suggestions based on scope


**Operation ID:** `utils-command-palette`


**Tags:** `Utils` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/extensions/{baseId}`

### GET /api/v2/extensions/{baseId}

> **Get Extensions**


Get all extensions for a given base


**Operation ID:** `extensions-list`


**Tags:** `Extensions` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### POST /api/v2/extensions/{baseId}

> **Create Extension**


Create a new extension for a given base


**Operation ID:** `extensions-create`


**Tags:** `Extensions` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/extensions/{extensionId}`

### GET /api/v2/extensions/{extensionId}

> **Get Extension**


Get extension details


**Operation ID:** `extensions-read`


**Tags:** `Extensions` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### PATCH /api/v2/extensions/{extensionId}

> **Update Extension**


Update extension details


**Operation ID:** `extensions-update`


**Tags:** `Extensions` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### DELETE /api/v2/extensions/{extensionId}

> **Delete Extension**


Delete extension


**Operation ID:** `extensions-delete`


**Tags:** `Extensions` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/jobs/listen`

### POST /jobs/listen

> **Jobs Listen**


Listen for job events


**Operation ID:** `jobs-listen`


**Tags:** `Jobs` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`



---
## `/api/v2/jobs/{baseId}`

### POST /api/v2/jobs/{baseId}

> **Get Jobs**


Get list of jobs for a given base for the user


**Operation ID:** `jobs-list`


**Tags:** `Jobs` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`



---
## `/api/v2/export/{viewId}/{exportAs}`

### POST /api/v2/export/{viewId}/{exportAs}

> **Trigger export as job**


Trigger export as job


**Operation ID:** `export-data`


**Tags:** `Export` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`



---
## `/api/v2/public/export/{publicDataUuid}/{exportAs}`

### POST /api/v2/public/export/{publicDataUuid}/{exportAs}

> **Trigger export as job**


Trigger export as job


**Operation ID:** `public-export-data`


**Tags:** `Public` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`



---
## `/api/v2/meta/hooks/{hookId}/trigger/{rowId}`

### POST /api/v2/meta/hooks/{hookId}/trigger/{rowId}

> **Trigger Manual Hook**


Trigger the manual WebHook


**Operation ID:** `db-table-webhook-trigger`


**Tags:** `DB Table Webhook` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `/api/v2/ai/bases/{baseId}/utils`

### POST /api/v2/ai/bases/{baseId}/utils

> **AI Utils**


AI Utils


**Operation ID:** `ai-utils`


**Tags:** `Ai` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/ai/bases/{baseId}/completion`

### POST /api/v2/ai/bases/{baseId}/completion

> **AI Completion**


AI Completion


**Operation ID:** `ai-completion`


**Tags:** `Ai` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/ai/bases/{baseId}/schema`

### POST /api/v2/ai/bases/{baseId}/schema

> **AI Schema**


AI Schema


**Operation ID:** `ai-schema`


**Tags:** `Ai` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/ai/workspaces/{workspaceId}/bases`

### POST /api/v2/ai/workspaces/{workspaceId}/bases

> **AI Schema**


AI Schema


**Operation ID:** `ai-schema-create`


**Tags:** `Ai` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/ai/tables/{modelId}/rows/generate`

### POST /api/v2/ai/tables/{modelId}/rows/generate

> **Generate AI Data**


Generate AI data for specified rows


**Operation ID:** `ai-data-generate`


**Tags:** `Ai` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `modelId` | **path** |  (string) | ✅ Yes | Model ID |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/ai/tables/{modelId}/rows/fill`

### POST /api/v2/ai/tables/{modelId}/rows/fill

> **Fill AI Data**


Fill AI data for specified rows


**Operation ID:** `ai-data-fill`


**Tags:** `Ai` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `modelId` | **path** |  (string) | ✅ Yes | Model ID |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/ai/tables/{modelId}/extract`

### POST /api/v2/ai/tables/{modelId}/extract

> **Extract Data using AI**


Extract AI data from the input


**Operation ID:** `ai-data-extract`


**Tags:** `Ai` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `modelId` | **path** |  (string) | ✅ Yes | Model ID |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/meta/integrations`

### GET /api/v2/meta/integrations

> **List integrations**


List integrations


**Operation ID:** `integration-list`


**Tags:** `Integration` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `type` | **query** |  | ❌ No | - |
| `includeDatabaseInfo` | **query** |  (boolean) | ❌ No | - |
| `limit` | **query** |  (number) | ❌ No | - |
| `offset` | **query** |  (number) | ❌ No | - |
| `baseId` | **query** |  (string) | ❌ No | - |
| `query` | **query** |  (string) | ❌ No | - |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### POST /api/v2/meta/integrations

> **Create integration**


Create integration


**Operation ID:** `integration-create`


**Tags:** `Integration` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/meta/integrations/{integrationId}`

### GET /api/v2/meta/integrations/{integrationId}

> **Read integration**


Read integration


**Operation ID:** `integration-read`


**Tags:** `Integration` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `includeConfig` | **query** |  (boolean) | ❌ No | - |
| `includeSources` | **query** |  (boolean) | ❌ No | - |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### PATCH /api/v2/meta/integrations/{integrationId}

> **Update integration**


Update integration


**Operation ID:** `integration-update`


**Tags:** `Integration` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### DELETE /api/v2/meta/integrations/{integrationId}

> **Delete integration**


Delete integration


**Operation ID:** `integration-delete`


**Tags:** `Integration` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/meta/integrations/{integrationId}/default`

### PATCH /api/v2/meta/integrations/{integrationId}/default

> **Set integration as category default**


Set integration as category default


**Operation ID:** `integration-set-default`


**Tags:** `Integration` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/integrations/:integrationId/store`

### POST /api/v2/integrations/:integrationId/store

> **Store integration**


Store integration


**Operation ID:** `integration-store`


**Tags:** `Integration` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `integrationId` | **path** |  (string) | ✅ Yes | - |


#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/integrations`

### GET /api/v2/integrations

> **Integration List**


List available integrations


**Operation ID:** `integrations-list`


**Tags:** `Integrations` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/integrations/:type/:subType`

### GET /api/v2/integrations/:type/:subType

> **Get Integration Info**


Get info for integration


**Operation ID:** `integrations-info`


**Tags:** `Integrations` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/integrations/:integrationId/:endpoint`

### POST /api/v2/integrations/:integrationId/:endpoint

> **Call exposed integration endpoint**


Call exposed integration endpoint


**Operation ID:** `integrations-endpoint`


**Tags:** `Integrations` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/tables/:tableId/button/:fieldId`

### POST /api/v2/tables/:tableId/button/:fieldId

> **Trigger a button action**


Trigger a button action


**Operation ID:** `action-trigger-button`


**Tags:** `Action` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/internal/:workspaceId/:baseId`

### POST /api/v2/internal/:workspaceId/:baseId

> **Trigger an internal operation**


Trigger an internal operation


**Operation ID:** `internal-post-operation`


**Tags:** `Internal` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### GET /api/v2/internal/:workspaceId/:baseId

> **Trigger an internal operation**


Trigger an internal operation


**Operation ID:** `internal-get-operation`


**Tags:** `Internal` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/workspaces/{workspaceId}/users`

### GET /api/v1/workspaces/{workspaceId}/users

> **Workspace users list**


Workspace users list


**Operation ID:** `workspace-user-list`


**Tags:** `Workspace user` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/workspaces/{workspaceId}/users/{userId}`

### GET /api/v1/workspaces/{workspaceId}/users/{userId}

> **Workspace user read**


Workspace user read


**Operation ID:** `workspace-user-read`


**Tags:** `Workspace user` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### PATCH /api/v1/workspaces/{workspaceId}/users/{userId}

> **Update workspace user**


Update workspace user


**Operation ID:** `workspace-user-update`


**Tags:** `Workspace user` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### DELETE /api/v1/workspaces/{workspaceId}/users/{userId}

> **Delete workspace user**


Delete workspace user


**Operation ID:** `workspace-user-delete`


**Tags:** `Workspace User` 




#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v1/workspaces/{workspaceId}/invitations`

### POST /api/v1/workspaces/{workspaceId}/invitations

> **Workspace user invite**


Workspace user invite


**Operation ID:** `workspace-user-invite`


**Tags:** `Workspace user` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** `object`


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `/api/v2/meta/workspaces/{workspaceId}/integrations`

### GET /api/v2/meta/workspaces/{workspaceId}/integrations

> **List integrations**


List integrations


**Operation ID:** `workspace-integration-list`


**Tags:** `Integration` 


#### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `type` | **query** |  | ❌ No | - |
| `includeDatabaseInfo` | **query** |  (boolean) | ❌ No | - |
| `limit` | **query** |  (number) | ❌ No | - |
| `offset` | **query** |  (number) | ❌ No | - |
| `baseId` | **query** |  (string) | ❌ No | - |
| `query` | **query** |  (string) | ❌ No | - |



#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
### POST /api/v2/meta/workspaces/{workspaceId}/integrations

> **Create integration**


Create integration


**Operation ID:** `workspace-integration-create`


**Tags:** `Integration` 



#### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  - **Schema:** ``


#### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
