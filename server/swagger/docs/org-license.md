# Org License

> Part of **nocodb**

---

## `GET` /api/v1/license

> Get App License


Get the application license key. Exclusive for super admin.


**Operation ID:** `org-license-get`


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
| `key` | string | Application license key |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/license

> Create App License


Set the application license key. Exclusive for super admin.


**Operation ID:** `org-license-set`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `key` | string | ❌ No | The license key |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
