# OAuth

> Part of **nocodb**

---

## `GET` /api/v2/public/oauth/client/{clientId}

> Get OAuth Client Information


Retrieve public information about an OAuth client for authorization display





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OAuth client information |
| **400** | Invalid client ID format |
| **404** | OAuth client not found |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `client_id` | string | OAuth client identifier |
| `client_name` | string | Application name |
| `client_uri` | string (uri) | Application homepage URL |
| `logo_uri` | object | Application logo URL or file metadata |
| `client_description` | string | Application description |
| `redirect_uris` | array[string] | Registered redirect URIs |
| `client_type` | string = `public` \| `confidential` | OAuth client type |
**`logo_uri`** ❌ — Application logo URL or file metadata



**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `error` | string | - |
| `error_description` | string | - |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `error` | string | - |
| `error_description` | string | - |



---
## `POST` /api/v2/oauth/authorize

> OAuth Authorization


Handle OAuth authorization request with user approval/denial


**Operation ID:** `authorize`



### Request Body

- **Required:** Yes

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `client_id` | string | ✅ Yes | The client identifier |
  | `redirect_uri` | string (uri) | ✅ Yes | The client redirection URI |
  | `state` | string | ❌ No | Opaque value used to maintain state between request and callback |
  | `approved` | boolean | ❌ No | Whether the user approved the authorization request |
  | `code_challenge` | string | ❌ No | PKCE code challenge |
  | `code_challenge_method` | string = `S256` \| `plain` | ❌ No | PKCE code challenge method |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | Authorization processed successfully |
| **400** | Missing required parameters |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `redirect_url` | string (uri) | URL to redirect the user to |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `message` | string | - |



---
