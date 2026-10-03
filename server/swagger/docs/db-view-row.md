# DB View Row

> Part of **nocodb**

---

## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/group/{columnId}

> Table Group by Column


Get the grouped data By Column ID. Used in Kanban View.


**Operation ID:** `db-view-row-grouped-data-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** | array | ❌ No | - |
| `sort` | **query** | array | ❌ No | - |
| `where` | **query** | string | ❌ No | - |
| `nested` | **query** | object | ❌ No | Query params for nested data |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}

> List Table View Rows


List all table view rows


**Operation ID:** `db-view-row-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** | array | ❌ No | - |
| `sort` | **query** | array | ❌ No | - |
| `where` | **query** | string | ❌ No | - |
| `nested` | **query** | object | ❌ No | Query params for nested data |
| `offset` | **query** | number | ❌ No | - |
| `getHiddenColumns` | **query** | boolean | ❌ No | - |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of table view rows |
| `pageInfo` | object | Paginated Info |



---
## `POST` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}

> Create Table View Row


Create a new row in the given Table View


**Operation ID:** `db-view-row-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
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
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/find-one

> Find One Table View Row


Return the first result of table view rows with the given query


**Operation ID:** `db-view-row-find-one`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `fields` | **query** | array | ❌ No | - |
| `sort` | **query** | array | ❌ No | - |
| `where` | **query** | string | ❌ No | - |
| `nested` | **query** | object | ❌ No | Query params for nested data |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/groupby

> Group By Table View Row


Get the table view rows grouped by the given query


**Operation ID:** `db-view-row-group-by`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** | array | ❌ No | - |
| `where` | **query** | string | ❌ No | - |
| `limit` | **query** | integer | ❌ No | - |
| `offset` | **query** | integer | ❌ No | - |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/groupby/count

> Count of Group By Table View Row 


Get the table view rows grouped by count the given query


**Operation ID:** `db-view-row-group-by-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** | array | ❌ No | - |
| `where` | **query** | string | ❌ No | - |
| `offset` | **query** | integer | ❌ No | - |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/count

> Count Table View Rows


Count how many rows in the given Table View


**Operation ID:** `db-view-row-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** | string | ❌ No | - |
| `nested` | **query** | object | ❌ No | Query params for nested data |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `count` | number | - |



---
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}

> Get Table View Row


Get the target Table View Row


**Operation ID:** `db-view-row-read`


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



---
## `PATCH` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}

> Update Table View Row


Update the target Table View Row


**Operation ID:** `db-view-row-update`


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
## `DELETE` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}

> Delete Table View Row


Delete the target Table View Row


**Operation ID:** `db-view-row-delete`


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
## `GET` /api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}/exist

> Does Table View Row Exist


Check row with provided primary key exists or not


**Operation ID:** `db-view-row-exist`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **201** | Created |
| **400** |  |


---
