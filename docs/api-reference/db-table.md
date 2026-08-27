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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/meta/projects/{baseId}/tables

> List Tables


List all tables in a given base


**Operation ID:** `db-table-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `page` | **query** |  (number) | ❌ No | - |
| `pageSize` | **query** |  (number) | ❌ No | - |
| `sort` | **query** |  (string) | ❌ No | - |
| `includeM2M` | **query** |  (boolean) | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | Example response |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/meta/tables/{tableId}

> Read Table


Read the table meta data by the given table ID


**Operation ID:** `db-table-read`


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
## `PATCH` /api/v1/db/meta/tables/{tableId}

> Update Table


Update the table meta data by the given table ID


**Operation ID:** `db-table-update`


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
## `DELETE` /api/v1/db/meta/tables/{tableId}

> Delete Table


Delete the table meta data by the given table ID


**Operation ID:** `db-table-delete`


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
## `POST` /api/v1/db/meta/duplicate/{baseId}/table/{tableId}

> Duplicate Table


Duplicate a table


**Operation ID:** `db-table-duplicate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `baseId` | **path** |  (string) | ✅ Yes | Unique Base ID |
| `tableId` | **path** |  (string) | ✅ Yes | Unique Table ID |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/meta/duplicate/{baseId}/column/{columnId}

> Duplicate Column


Duplicate a column


**Operation ID:** `duplicate-column`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `baseId` | **path** |  (string) | ✅ Yes | Unique Base ID |
| `columnId` | **path** |  (string) | ✅ Yes | Unique Column ID |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/meta/tables/{tableId}/reorder

> Reorder Table


Update the order of the given Table


**Operation ID:** `db-table-reorder`


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
