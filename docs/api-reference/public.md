# Public

> Part of **nocodb**

---

## `GET` /api/v1/db/public/calendar-view/{sharedViewUuid}/countByDate

> Count of Records in Dates in Calendar View


**Operation ID:** `public-data-calendar-row-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `from_date` | **query** |  (string) | ✅ Yes | - |
| `prev_date` | **query** |  (string) | ✅ Yes | - |
| `next_date` | **query** |  (string) | ✅ Yes | - |
| `to_date` | **query** |  (string) | ✅ Yes | - |
| `sort` | **query** |  (array) | ❌ No | - |
| `where` | **query** |  (string) | ❌ No | - |
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v2/public/shared-view/{sharedViewUuid}/count

> Count Table View Rows


Count how many rows in the given Table View


**Operation ID:** `public-db-view-row-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | - |
| `nested` | **query** |  | ❌ No | Query params for nested data |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/public/shared-view/{sharedViewUuid}/bulk/dataList

> Read Shared View Bulk Data List


Read bulk data from a given table with provided filters


**Operation ID:** `public-data-table-bulk-data-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v2/public/shared-view/{sharedViewUuid}/bulk/group

> Read Shared View Bulk Group Data


Read bulk group data from a given table with provided filters


**Operation ID:** `public-data-table-bulk-group`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v2/public/shared-view/{sharedViewUuid}/aggregate

> Read Shared View Aggregated Data


Read aggregated data from a given table


**Operation ID:** `public-data-table-aggregate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `aggregation` | **query** |  (array) | ❌ No | Used for selective aggregation |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v2/public/shared-view/{sharedViewUuid}/bulk/aggregate

> Read Shared View Bulk Aggregated Data


Read bulk aggregated data from a given table with provided filters


**Operation ID:** `public-data-table-bulk-aggregate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `aggregation` | **query** |  (array) | ❌ No | Used for selective aggregation |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v2/public/shared-view/{sharedViewUuid}/downloadAttachment/{columnId}/{rowId}

> Get Shared View Attachment


Download attachment from a shared view


**Operation ID:** `public-data-attachment-download`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `urlOrPath` | **query** |  (string) | ❌ No | URL or Path of the attachment |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/public/shared-view/{sharedViewUuid}/group/{columnId}

> List Shared View Grouped Data


List Shared View Grouped Data


**Operation ID:** `public-grouped-data-list`


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



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/public/shared-view/{sharedViewUuid}/rows

> List Shared View Rows


List all shared view rows


**Operation ID:** `public-data-list`


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



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/public/shared-view/{sharedViewUuid}/rows

> Create Share View Row


Create a new row for the target shared view


**Operation ID:** `public-data-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-password` | **header** |  (string) | ❌ No | Shared view password |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/public/shared-view/{sharedViewUuid}/groupby

> List Shared View Rows


List all shared view rows grouped by a column


**Operation ID:** `public-data-group-by`


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
| `column_name` | **query** |  (string) | ❌ No | Columns to group by |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v2/public/shared-view/{sharedViewUuid}/groupby/count

> Group By Table Row Count


Get the number of groups by the given query


**Operation ID:** `public-data-group-by-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `sort` | **query** |  | ❌ No | The result will be sorted based on &#x60;sort&#x60; query |
| `where` | **query** |  (string) | ❌ No | Extra filtering |
| `filterArrJson` | **query** |  (string) | ❌ No | Used for multiple filter queries |
| `column_name` | **query** |  (string) | ❌ No | Columns to group by |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/public/shared-view/{sharedViewUuid}/rows/{rowId}/{relationType}/{columnName}

> List Nested List Data


List all nested list data in a given shared view


**Operation ID:** `public-data-nested-list`


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



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/public/shared-view/{sharedViewUuid}/nested/{columnName}

> List Nested Data Relation


List Nested Data Relation


**Operation ID:** `public-data-relation-list`


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



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/public/shared-base/{sharedBaseUuid}/meta

> Get Share Source Meta


Get Share Source Meta


**Operation ID:** `public-shared-base-get`


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
## `GET` /api/v1/db/public/shared-view/{sharedViewUuid}/meta

> Get Share View Meta


Get Share View Meta


**Operation ID:** `public-shared-view-meta-get`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/public/shared-erd/{sharedErdUuid}/meta



**Operation ID:** `public-shared-erd-meta-get`





---
## `POST` /api/v2/public/export/{publicDataUuid}/{exportAs}

> Trigger export as job


Trigger export as job


**Operation ID:** `public-export-data`



### Request Body

- **Required:** No



---
