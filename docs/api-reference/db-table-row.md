# DB Table Row

> Part of **nocodb**

---

## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}

> List Table Rows


List all table rows in a given table and base


**Operation ID:** `db-table-row-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `pks` | **query** |  (string) | ❌ No | Comma separated list of pks |
| `getHiddenColumns` | **query** |  (string) | ❌ No | Get hidden columns on List Api |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/data/{orgs}/{baseName}/{tableName}

> Create Table Row


Create a new row in a given table and base.


**Operation ID:** `db-table-row-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `before` | **query** |  (string) | ❌ No | - |
| `undo` | **query** |  (boolean) | ❌ No | - |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/find-one

> Find One Table Row


Return the first result of the target Table Row


**Operation ID:** `db-table-row-find-one`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/groupby

> Group By Table Row


Get the result grouped by the given query


**Operation ID:** `db-table-row-group-by`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/groupby/count

> Group By Table Row Count


Get the number of groups by the given query


**Operation ID:** `db-table-row-group-by-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/group/{columnId}

> Table Group by Column


Get the grouped data By Column ID. Used in Kanban View.


**Operation ID:** `db-table-row-grouped-data-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}

> Get Table Row


Get the Table Row by Row ID


**Operation ID:** `db-table-row-read`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `PATCH` /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}

> Update Table Row


Update the Table Row


**Operation ID:** `db-table-row-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `DELETE` /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}

> Delete Table Row


Delete the Table Row


**Operation ID:** `db-table-row-delete`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/exist

> Does Table Row Exist


check row with provided primary key exists or not


**Operation ID:** `db-table-row-exist`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/upsert

> Bulk Upsert Table Rows


Bulk upsert table rows in one go.


**Operation ID:** `db-table-row-bulk-upsert`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}

> Bulk Insert Table Rows


Bulk insert table rows in one go.


**Operation ID:** `db-table-row-bulk-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `undo` | **query** |  (string) | ❌ No | - |
| `nc-operation-id` | **header** |  (string) | ❌ No | Operation ID |
| `nc-import-type` | **header** |  (string) | ❌ No | Import Type if triggering from import |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `PATCH` /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}

> Bulk Update Table Rows by IDs


Bulk Update Table Rows by given IDs


**Operation ID:** `db-table-row-bulk-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `DELETE` /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}

> Bulk Delete Table Rows by IDs


Bulk Delete Table Rows by given IDs


**Operation ID:** `db-table-row-bulk-delete`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `PATCH` /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/all

> Bulk Update Table Rows with Conditions


Bulk Update all Table Rows if the condition is true


**Operation ID:** `db-table-row-bulk-update-all`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `DELETE` /api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/all

> Bulk Delete Table Rows with Conditions


Bulk Delete all Table Rows if the condition is true


**Operation ID:** `db-table-row-bulk-delete-all`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}

> List Nested Relations Rows


List all nested relations rows


**Operation ID:** `db-table-row-nested-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}

> Create Nested Relations Row


Create a new nested relations row


**Operation ID:** `db-table-row-nested-add`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** |  (array) | ❌ No | Which fields to be shown |
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `offset` | **query** |  (integer) | ❌ No | Offset in rows |
| `limit` | **query** |  (integer) | ❌ No | Limit in rows |
| `sortArrJson` | **query** |  (string) | ❌ No | Used for multiple sort queries |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `DELETE` /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}

> Delete Nested Relations Row


Delete a new nested relations row


**Operation ID:** `db-table-row-nested-remove`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/exclude

> Referenced Table Rows Excluding Current Record&#x27;s Children / Parent


Get the table rows but exculding the current record&#x27;s children and parent


**Operation ID:** `db-table-row-nested-children-excluded-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
