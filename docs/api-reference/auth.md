# Auth

> Part of **nocodb**

---

## `POST` /api/v1/auth/user/signup

> Signup


Create a new user with provided email and password and first user is marked as super admin. 


**Operation ID:** `auth-signup`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | Bad Request |


---
## `POST` /api/v1/auth/user/signout

> Signout


Clear refresh token from the database and cookie.


**Operation ID:** `auth-signout`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/auth/user/signin

> Signin


Authenticate existing user with their email and password. Successful login will return a JWT access-token. 


**Operation ID:** `auth-signin`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `GET` /api/v1/auth/user/me

> Get User Info


Returns authenticated user info


**Operation ID:** `auth-me`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `base_id` | **query** |  (string) | ❌ No | Pass base id to get base specific roles along with user info |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/auth/password/forgot

> Forget Password


Emails user with a reset url.


**Operation ID:** `auth-password-forgot`



### Request Body

Pass registered user email id in request body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/auth/password/change

> Change Password


Change password of authenticated user with a new one.


**Operation ID:** `auth-password-change`



### Request Body

Old password need to be passed along with new password for changing password.

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/auth/token/validate/{token}

> Verify Reset Token


Validate password reset url token.


**Operation ID:** `auth-password-reset-token-validate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/auth/email/validate/{token}

> Verify Email


Api for verifying email where token need to be passed which is shared to user email.


**Operation ID:** `auth-email-validate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/auth/password/reset/{token}

> Reset Password


Update user password to new by using reset token.


**Operation ID:** `auth-password-reset`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/auth/token/refresh

> Refresh Token


Creates a new refresh token and JWT auth token for the user. The refresh token is sent as a cookie, while the JWT auth token is included in the response body.


**Operation ID:** `auth-token-refresh`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `GET` /api/v1/db/meta/projects/{baseId}/users

> List Base Users


List all users in the given base.


**Operation ID:** `auth-base-user-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/db/meta/projects/{baseId}/users

> Create Base User


Create a user and add it to the given base


**Operation ID:** `auth-base-user-add`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `PATCH` /api/v1/db/meta/projects/{baseId}/users/{userId}

> Update Base User


Update a given user in a given base. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `auth-base-user-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `DELETE` /api/v1/db/meta/projects/{baseId}/users/{userId}

> Delete Base User


Delete a given user in a given base. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `auth-base-user-remove`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/db/meta/projects/{baseId}/users/{userId}/resend-invite

> Resend User Invitation


Resend Invitation to a specific user


**Operation ID:** `auth-base-user-resend-invite`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
