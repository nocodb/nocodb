# DB Table Sort

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/views/{viewId}/sorts

> List View Sorts


List all the sort data in a given View


**Operation ID:** `db-table-sort-list`


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
| `list` | array[object] | List of Sort Objects |
| `pageInfo` | object | - |
**`list`** — Array of `object` — List of Sort Objects




---
## `POST` /api/v1/db/meta/views/{viewId}/sorts

> Update View Sort


Update the sort data in a given View


**Operation ID:** `db-table-sort-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_column_id` | object | ❌ No | Foreign Key to Column |
  | `direction` | string = `asc` \| `desc` | ❌ No | Sort direction |
  | `fk_level_id` | object | ❌ No | Foreign Key to List View Level |
  | `push_to_top` | boolean | ❌ No | Push the sort to the top of the list |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/sorts/{sortId}

> Get Sort


Get the sort data by Sort ID


**Operation ID:** `db-table-sort-get`


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
## `PATCH` /api/v1/db/meta/sorts/{sortId}

> Update Sort


Update the sort data by Sort ID


**Operation ID:** `db-table-sort-update`


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
## `DELETE` /api/v1/db/meta/sorts/{sortId}

> Delete Sort


Delete the sort data by Sort ID


**Operation ID:** `db-table-sort-delete`


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
