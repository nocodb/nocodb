# DB Table Webhook

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/tables/{tableId}/hooks

> List Table Hooks


List all hook records in the given Table


**Operation ID:** `db-table-webhook-list`


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
| `list` | array[object] | List of hook objects |
| `pageInfo` | object | - |
**`list`** — Array of `object` — List of hook objects




---
## `POST` /api/v1/db/meta/tables/{tableId}/hooks

> Create Table Hook


Create a hook in the given table


**Operation ID:** `db-table-webhook-create`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `active` | object | ❌ No | Is the hook active? |
  | `async` | object | ❌ No | Is the hook aysnc? |
  | `description` | object | ❌ No | Hook Description |
  | `env` | string | ❌ No | Environment for the hook |
  | `event` | string = `view` \| `field` \| `after` \| `before` \| `manual` | ✅ Yes | Event Type for the operation |
  | `fk_model_id` | string | ❌ No | Foreign Key to Model |
  | `id` | object | ❌ No | Unique ID |
  | `notification` | object,string | ✅ Yes | Hook Notification including info such as type, payload, method, body, and etc |
  | `operation` | array[string] | ✅ Yes | Hook Operation |
  | `retries` | number | ❌ No | Retry Count |
  | `retry_interval` | number | ❌ No | Retry Interval |
  | `timeout` | number | ❌ No | Timeout |
  | `title` | string | ✅ Yes | Hook Title |
  | `type` | string,null | ❌ No | Hook Type |
  | `condition` | object | ❌ No | Is this hook assoicated with some filters |
  | `trigger_field` | boolean | ❌ No | Is this hook only trigger when some fields are affected |
  | `trigger_fields` | array[string] | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `POST` /api/v1/db/meta/tables/{tableId}/hooks/test

> Test Hook


Test the hook in the given Table


**Operation ID:** `db-table-webhook-test`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `hook` | object | ✅ Yes | - |
  | `payload` | object | ✅ Yes | Payload to be sent |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `GET` /api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{event}/{operation}/{version}

> Get Sample Hook Payload


Get the sample hook payload


**Operation ID:** `db-table-webhook-sample-payload-get`


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
| `data` | object | Sample Payload Data |



---
## `PATCH` /api/v1/db/meta/hooks/{hookId}

> Update Hook


Update the exsiting hook by its ID


**Operation ID:** `db-table-webhook-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`

  - **Type:** `object`



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `DELETE` /api/v1/db/meta/hooks/{hookId}

> Delete Hook


Delete the exsiting hook by its ID


**Operation ID:** `db-table-webhook-delete`


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
## `POST` /api/v2/meta/hooks/{hookId}/trigger/{rowId}

> Trigger Manual Hook


Trigger the manual WebHook


**Operation ID:** `db-table-webhook-trigger`


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
