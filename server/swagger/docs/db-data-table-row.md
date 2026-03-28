# DB Data Table Row

> Part of **nocodb**

---

## `GET` /api/v2/tables/{tableId}/records

> List Table Rows


List all table rows in a given table


**Operation ID:** `db-data-table-row-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** | array | ❌ No | Which fields to be shown |
| `sort` | **query** | array | ❌ No | The result will be sorted based on `sort` query |
| `where` | **query** | string | ❌ No | Extra filtering |
| `offset` | **query** | integer | ❌ No | Offset in rows |
| `limit` | **query** | integer | ❌ No | Limit in rows |
| `sortArrJson` | **query** | string | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** | string | ❌ No | Used for multiple filter queries |
| `pks` | **query** | string | ❌ No | Comma separated list of pks |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of data objects |
| `pageInfo` | object | Paginated Info |



---
## `POST` /api/v2/tables/{tableId}/records

> Create Table Rows


Create a new row in a given table and base.


**Operation ID:** `db-data-table-row-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `before` | **query** | string | ❌ No | - |
| `undo` | **query** | string | ❌ No | - |


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
## `PATCH` /api/v2/tables/{tableId}/records

> Update Table Rows


Create a new row in a given table and base.


**Operation ID:** `db-data-table-row-update`


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
## `DELETE` /api/v2/tables/{tableId}/records

> Delete Table Rows


Create a new row in a given table and base.


**Operation ID:** `db-data-table-row-delete`


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
## `GET` /api/v2/tables/{tableId}/records/{rowId}

> Read Table Row


Get table row in a given table


**Operation ID:** `db-data-table-row-read`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** | array | ❌ No | Which fields to be shown |
| `offset` | **query** | integer | ❌ No | Offset in rows |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `POST` /api/v2/tables/{tableId}/records/{rowId}/move

> Move Table Row


Move the table row to new position


**Operation ID:** `db-data-table-row-move`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `before` | **query** | string | ❌ No | The row ID before which the row should be moved |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v2/tables/{tableId}/records/count

> Table Rows Count


Count of rows in a given table


**Operation ID:** `db-data-table-row-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** | array | ❌ No | Which fields to be shown |
| `where` | **query** | string | ❌ No | Extra filtering |
| `filterArrJson` | **query** | string | ❌ No | Used for multiple filter queries |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `count` | number | - |



---
## `GET` /api/v2/tables/{tableId}/links/{columnId}/records/{rowId}

> Get Nested Relations Rows


Linked rows in a given Links/LinkToAnotherRecord column


**Operation ID:** `db-data-table-row-nested-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** | array | ❌ No | Which fields to be shown |
| `sort` | **query** | array | ❌ No | The result will be sorted based on `sort` query |
| `where` | **query** | string | ❌ No | Extra filtering |
| `offset` | **query** | integer | ❌ No | Offset in rows |
| `limit` | **query** | integer | ❌ No | Limit in rows |
| `sortArrJson` | **query** | string | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** | string | ❌ No | Used for multiple filter queries |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of data objects |
| `pageInfo` | object | Paginated Info |



---
## `POST` /api/v2/tables/{tableId}/links/{columnId}/records/{rowId}

> Create Nested Relations Rows


Create a link with the row.


**Operation ID:** `db-data-table-row-nested-link`


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
## `DELETE` /api/v2/tables/{tableId}/links/{columnId}/records/{rowId}

> Delete Nested Relations Rows


Create a new row in a given table and base.


**Operation ID:** `db-data-table-row-nested-unlink`


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
## `GET` /api/v2/downloadAttachment/{modelId}/{columnId}/{rowId}

> Download Attachment


Download attachment from a given row


**Operation ID:** `db-data-table-row-attachment-download`


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
| `url` | string | URL to download attachment |
| `path` | string | Path to download attachment |



---
## `POST` /api/v2/tables/{tableId}/links/{columnId}/records

> Copy paste or deleteAll nested link


Copy links from the one cell and paste them into another cell or delete all records from cell


**Operation ID:** `db-data-table-row-nested-list-copy-paste-or-deleteAll`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** Yes

- **Content-Type:** `application/json`

  **Array of:** object

  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `operation` | string = `copy` \| `paste` \| `deleteAll` | ❌ No | - |
  | `rowId` | string | ❌ No | - |
  | `columnId` | string | ❌ No | - |
  | `fk_related_model_id` | string | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
