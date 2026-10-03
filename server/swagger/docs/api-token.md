# API Token

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/projects/{baseId}/api-tokens

> List API Tokens in Base


List API Tokens in the given base


**Operation ID:** `api-token-list`


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
| `list` | array[object] | List of api token objects |
| `pageInfo` | object | Model for Paginated |
**`list`** — Array of `object` — List of api token objects

**`pageInfo`** ✅ — Model for Paginated




---
## `POST` /api/v1/db/meta/projects/{baseId}/api-tokens

> Create API Token


Create API Token in a base


**Operation ID:** `api-token-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


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
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Model for ID |
| `fk_user_id` | string | Model for ID |
| `description` | string | API Token Description |
| `token` | string | API Token |



---
## `DELETE` /api/v1/db/meta/projects/{baseId}/api-tokens/{tokenId}

> Delete API Token


Delete the given API Token in base


**Operation ID:** `api-token-delete`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
