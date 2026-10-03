# Auth

> Part of **nocodb**

---

## `POST` /api/v1/auth/user/signup

> Signup


Create a new user with provided email and password and first user is marked as super admin.


**Operation ID:** `auth-signup`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `email` | string (email) | ✅ Yes | Email address of the user |
  | `password` | string | ✅ Yes | Password of the user |
  | `firstname` | string | ❌ No | Model for StringOrNull |
  | `lastname` | string | ❌ No | Model for StringOrNull |
  | `token` | string | ❌ No | Sign Up Token. Used for invitation. |
  | `ignore_subscribe` | integer | ❌ No | 0 or 1 |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | Bad Request |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `token` | string | The signed JWT token for information exchange |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



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

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/auth/user/signin

> Signin


Authenticate existing user with their email and password. Successful login will return a JWT access-token.


**Operation ID:** `auth-signin`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `email` | string (email) | ✅ Yes | Email address of the user |
  | `password` | string | ✅ Yes | Password of the user |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `token` | string | The signed JWT token for information exchange |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `GET` /api/v1/auth/user/me

> Get User Info


Returns authenticated user info


**Operation ID:** `auth-me`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `base_id` | **query** | string | ❌ No | Pass base id to get base specific roles along with user info |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `email` | string (email) | User Email |
| `email_verified` | boolean | Set to true if the user's email has been verified. |
| `firstname` | string | The firstname of the user |
| `id` | string | User ID |
| `lastname` | string | The lastname of the user |
| `roles` | object | The roles of the user |
| `base_roles` | object | The base roles of the user |
| `workspace_roles` | object | The workspace roles of the user |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/auth/password/forgot

> Forget Password


Emails user with a reset url.


**Operation ID:** `auth-password-forgot`



### Request Body

Pass registered user email id in request body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `email` | string (email) | ✅ Yes | Email address of the user |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/auth/password/change

> Change Password


Change password of authenticated user with a new one.


**Operation ID:** `auth-password-change`



### Request Body

Old password need to be passed along with new password for changing password.

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `currentPassword` | string | ✅ Yes | - |
  | `newPassword` | string | ✅ Yes | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/auth/token/validate/{token}

> Verify Reset Token


Validate password reset url token.


**Operation ID:** `auth-password-reset-token-validate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/auth/email/validate/{token}

> Verify Email


Api for verifying email where token need to be passed which is shared to user email.


**Operation ID:** `auth-email-validate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/auth/password/reset/{token}

> Reset Password


Update user password to new by using reset token.


**Operation ID:** `auth-password-reset`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `password` | string | ✅ Yes | New password |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/auth/token/refresh

> Refresh Token


Creates a new refresh token and JWT auth token for the user. The refresh token is sent as a cookie, while the JWT auth token is included in the response body.


**Operation ID:** `auth-token-refresh`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `token` | string | New JWT auth token for user |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `GET` /api/v1/db/meta/projects/{baseId}/users

> List Base Users


List all users in the given base.


**Operation ID:** `auth-base-user-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `users` | object | - |
**`users`** ✅

  **`list`** — Array of `object`

  **`pageInfo`** ✅ — Model for Paginated



**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/db/meta/projects/{baseId}/users

> Create Base User


Create a user and add it to the given base


**Operation ID:** `auth-base-user-add`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `email` | string | ✅ Yes | Base User Email |
  | `roles` | string = `no-access` \| `commenter` \| `editor` \| `guest` \| `owner` \| `viewer` \| `creator` \| `inherit` | ✅ Yes | Base User Role |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message for inviting single email |
| `invite_token` | string | - |
| `error` | array[object] | - |
| `email` | string | - |
**`error`** — Array of `object`



**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `PATCH` /api/v1/db/meta/projects/{baseId}/users/{userId}

> Update Base User


Update a given user in a given base. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `auth-base-user-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `email` | string | ✅ Yes | Base User Email |
  | `roles` | string = `no-access` \| `commenter` \| `editor` \| `guest` \| `owner` \| `viewer` \| `creator` \| `inherit` | ✅ Yes | Base User Role |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `DELETE` /api/v1/db/meta/projects/{baseId}/users/{userId}

> Delete Base User


Delete a given user in a given base. Exclusive for Super Admin. Access with API Tokens will be blocked.


**Operation ID:** `auth-base-user-remove`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/db/meta/projects/{baseId}/users/{userId}/resend-invite

> Resend User Invitation


Resend Invitation to a specific user


**Operation ID:** `auth-base-user-resend-invite`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | Success Message |



---
