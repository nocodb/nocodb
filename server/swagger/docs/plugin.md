# Plugin

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/plugins

> List Plugins


List all plugins


**Operation ID:** `plugin-list`


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
| `list` | array[object] | - |
| `pageInfo` | object | - |
**`list`** — Array of `object`




---
## `GET` /api/v1/db/meta/plugins/webhook

> Webhook List Plugins


List all webhook plugins


**Operation ID:** `plugin-webhook-list`


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
| `list` | array[object] | - |
| `pageInfo` | object | - |



---
## `GET` /api/v1/db/meta/plugins/{pluginId}/status

> Get Plugin Status


Check plugin is active or not


**Operation ID:** `plugin-status`


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
## `POST` /api/v1/db/meta/plugins/test

> Test Plugin


Test if the plugin is working with the given configurations


**Operation ID:** `plugin-test`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `title` | string | ✅ Yes | Plugin Title |
  | `input` | string | ✅ Yes | Plugin Input as JSON string |
  | `category` | string | ✅ Yes | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `PATCH` /api/v1/db/meta/plugins/{pluginId}

> Update Plugin


Update the plugin data by ID


**Operation ID:** `plugin-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `active` | object | ❌ No | Is Plugin Active? |
  | `input` | string | ❌ No | Plugin Input |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/plugins/{pluginId}

> Get Plugin


Get the plugin data by ID


**Operation ID:** `plugin-read`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
