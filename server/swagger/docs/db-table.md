# DB Table

> Part of **nocodb**

---

## `POST` /api/v1/db/meta/projects/{baseId}/tables

> Create Table


Create a new table in a given base


**Operation ID:** `db-table-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `columns` | array[object] | ✅ Yes | The column models in this table |
  | `description` | object | ❌ No | Table description |
  | `meta` | object | ❌ No | the meta data for this table |
  | `order` | number | ❌ No | The order of table list |
  | `table_name` | string | ❌ No | Table name |
  | `title` | string | ✅ Yes | Table title |
  **`columns`** — Array of `object` — The column models in this table





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `source_id` | string | Unique Source ID |
| `date_dependency` | object | Model for Date Dependency |
| `columns` | array[object] | The columns included in this table |
| `columnsById` | object | Column Models grouped by IDs |
| `columnsHash` | string | Hash of columns |
| `deleted` | object | - |
| `enabled` | object | Is this table enabled? |
| `id` | string | Unique Table ID |
| `meta` | object | Meta Data |
| `mm` | object | Is this table used for M2M |
| `order` | number | The order of the list of tables |
| `pinned` | object | Currently not in use |
| `base_id` | string | Unique Base ID |
| `description` | object | Table Description |
| `table_name` | string | Table Name. Prefix will be added for XCDB bases. |
| `tags` | object | Currently not in use |
| `title` | string | Table Title |
| `type` | string | Table Type |
| `synced` | object | Is this table synced? |
**`date_dependency`** ❌ — Model for Date Dependency

**`columns`** — Array of `object` — The columns included in this table

  **`colOptions`** ❌ — Model for LinkToAnotherRecord




---
## `GET` /api/v1/db/meta/projects/{baseId}/tables

> List Tables


List all tables in a given base


**Operation ID:** `db-table-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `page` | **query** | number | ❌ No | - |
| `pageSize` | **query** | number | ❌ No | - |
| `sort` | **query** | string | ❌ No | - |
| `includeM2M` | **query** | boolean | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | Example response |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of table objects |
| `pageInfo` | object | Paginated Info |
**`pageInfo`** ✅ — Paginated Info




---
## `GET` /api/v1/db/meta/tables/{tableId}

> Read Table


Read the table meta data by the given table ID


**Operation ID:** `db-table-read`


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
## `PATCH` /api/v1/db/meta/tables/{tableId}

> Update Table


Update the table meta data by the given table ID


**Operation ID:** `db-table-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `table_name` | string | ❌ No | Table name |
  | `title` | string | ❌ No | Table title |
  | `description` | object | ❌ No | Table description |
  | `base_id` | string | ❌ No | Base ID |
  | `meta` | object | ❌ No | - |
  



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
## `DELETE` /api/v1/db/meta/tables/{tableId}

> Delete Table


Delete the table meta data by the given table ID


**Operation ID:** `db-table-delete`


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
## `POST` /api/v1/db/meta/duplicate/{baseId}/table/{tableId}

> Duplicate Table


Duplicate a table


**Operation ID:** `db-table-duplicate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `baseId` | **path** | string | ✅ Yes | Unique Base ID |
| `tableId` | **path** | string | ✅ Yes | Unique Table ID |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `options` | object | ❌ No | - |
  **`options`** ❌





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `name` | string | - |
| `id` | string | - |



---
## `POST` /api/v1/db/meta/duplicate/{baseId}/column/{columnId}

> Duplicate Column


Duplicate a column


**Operation ID:** `duplicate-column`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `baseId` | **path** | string | ✅ Yes | Unique Base ID |
| `columnId` | **path** | string | ✅ Yes | Unique Column ID |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `options` | object | ❌ No | - |
  | `extra` | object | ❌ No | - |
  **`options`** ❌





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `name` | string | - |
| `id` | string | - |



---
## `POST` /api/v1/db/meta/tables/{tableId}/reorder

> Reorder Table


Update the order of the given Table


**Operation ID:** `db-table-reorder`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `order` | number | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
