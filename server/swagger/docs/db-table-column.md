# DB Table Column

> Part of **nocodb**

---

## `POST` /api/v1/db/meta/tables/{tableId}/columns

> Create Column


Create a new column in a given Table


**Operation ID:** `db-table-column-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `title` | string | ✅ Yes | - |
  | `uidt` | string = `Formula` | ❌ No | UI Data Type |
  | `type` | string = `webhook` \| `url` \| `ai` \| `script` | ❌ No | Whether button is webhook or url |
  | `theme` | object = `solid` \| `text` \| `light` | ❌ No | Button Theme |
  | `color` | object = `brand` \| `red` \| `green` \| `maroon` \| `blue` \| `orange` \| `pink` \| `purple` \| `yellow` \| `gray` | ❌ No | Button color |
  | `label` | string | ❌ No | Label of Button |
  | `icon` | string | ❌ No | Button Icon |
  | `fk_webhook_id` | object | ❌ No | Webhook ID |
  | `formula` | string | ❌ No | Formula with column ID replaced |
  | `formula_raw` | string | ❌ No | Original Formula inputted in UI |
  | `column_name` | string | ❌ No | - |
  | `description` | object | ❌ No | - |
  | `column_order` | object | ❌ No | Column order in a specific view |
  | `view_id` | string | ❌ No | - |
  **`column_order`** ❌ — Column order in a specific view





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `PATCH` /api/v1/db/meta/columns/{columnId}

> Update Column


Update the existing column by the given column ID


**Operation ID:** `db-table-column-update`


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
## `DELETE` /api/v1/db/meta/columns/{columnId}

> Delete Column


Delete the existing column by the given column ID


**Operation ID:** `db-table-column-delete`


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
## `GET` /api/v1/db/meta/columns/{columnId}

> Get Column


Get the existing column by the given column ID


**Operation ID:** `db-table-column-get`


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
## `POST` /api/v1/db/meta/columns/{columnId}/primary

> Create Primary Value


Set a primary value on a given column


**Operation ID:** `db-table-column-primary-column-set`


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
## `GET` /api/v1/db/meta/tables/{tableId}/columns/hash

> Get columns hash for table


Get columns hash for table


**Operation ID:** `db-table-column-hash`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `hash` | string | Columns hash |



---
## `POST` /api/v1/db/meta/tables/{tableId}/columns/bulk

> Bulk create-update-delete columns


Bulk create-update-delete columns


**Operation ID:** `db-table-column-bulk`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `hash` | string | ❌ No | Columns hash |
  | `ops` | array[object] | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `failedOps` | array[object] | - |



---
