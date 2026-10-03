# Org Tokens

> Part of **nocodb**

---

## `GET` /api/v1/tokens

> List Organisation API Tokens


List all organisation API tokens.  Access with API tokens will be blocked.


**Operation ID:** `org-tokens-list`


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
| `list` | array[object] | List of api token objects |
| `pageInfo` | object | Model for Paginated |
**`list`** — Array of `object` — List of api token objects

**`pageInfo`** ✅ — Model for Paginated



**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/tokens

> Create Organisation API Token


Creat an organisation API token. Access with API tokens will be blocked.


**Operation ID:** `org-tokens-create`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `description` | string | ❌ No | Description of the API token |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Model for ID |
| `fk_user_id` | string | Model for ID |
| `description` | string | API Token Description |
| `token` | string | API Token |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `DELETE` /api/v1/tokens/{tokenId}

> Delete Organisation API Tokens


Delete an organisation API token. Access with API tokens will be blocked.


**Operation ID:** `org-tokens-delete`


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
| `msg` | string | - |



---
