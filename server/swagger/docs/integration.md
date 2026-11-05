# Integration

> Part of **nocodb**

---

## `GET` /api/v2/meta/integrations

> List integrations


List integrations


**Operation ID:** `integration-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `type` | **query** | object | ❌ No | - |
| `includeDatabaseInfo` | **query** | boolean | ❌ No | - |
| `limit` | **query** | number | ❌ No | - |
| `offset` | **query** | number | ❌ No | - |
| `baseId` | **query** | string | ❌ No | - |
| `query` | **query** | string | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of Integration Models |
| `pageInfo` | object | Pagination Info |
**`list`** — Array of `object` — List of Integration Models




---
## `POST` /api/v2/meta/integrations

> Create integration


Create integration


**Operation ID:** `integration-create`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `title` | string | ✅ Yes | Integration Name - Default BASE will be null by default |
  | `config` | object | ✅ Yes | Source Configuration |
  | `meta` | object | ❌ No | Integration metas |
  | `type` | object | ✅ Yes | - |
  | `sub_type` | string | ❌ No | Sub Type |
  | `copy_from_id` | object | ❌ No | ID of integration to be copied from. Used in Copy Integration. |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v2/meta/integrations/{integrationId}

> Read integration


Read integration


**Operation ID:** `integration-read`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `includeConfig` | **query** | boolean | ❌ No | - |
| `includeSources` | **query** | boolean | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `PATCH` /api/v2/meta/integrations/{integrationId}

> Update integration


Update integration


**Operation ID:** `integration-update`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`

  - **Type:** `object`



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `DELETE` /api/v2/meta/integrations/{integrationId}

> Delete integration


Delete integration


**Operation ID:** `integration-delete`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `PATCH` /api/v2/meta/integrations/{integrationId}/default

> Set integration as category default


Set integration as category default


**Operation ID:** `integration-set-default`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/integrations/:integrationId/store

> Store integration


Store integration


**Operation ID:** `integration-store`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `integrationId` | **path** | string | ✅ Yes | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `op` | string = `list` | ✅ Yes | - |
  | `limit` | number | ✅ Yes | - |
  | `offset` | number | ✅ Yes | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v2/meta/workspaces/{workspaceId}/integrations

> List integrations


List integrations


**Operation ID:** `workspace-integration-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `type` | **query** | object | ❌ No | - |
| `includeDatabaseInfo` | **query** | boolean | ❌ No | - |
| `limit` | **query** | number | ❌ No | - |
| `offset` | **query** | number | ❌ No | - |
| `baseId` | **query** | string | ❌ No | - |
| `query` | **query** | string | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/meta/workspaces/{workspaceId}/integrations

> Create integration


Create integration


**Operation ID:** `workspace-integration-create`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`

  - **Type:** `object`



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
