# DB View Column

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/views/{viewId}/columns

> List Columns In View


List all columns by ViewID


**Operation ID:** `db-view-column-list`


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
| `list` | array[object] | List of column objects |
| `pageInfo` | object | - |



---
## `POST` /api/v1/db/meta/views/{viewId}/columns

> Create Column in View


Create a new column in a given View


**Operation ID:** `db-view-column-create`


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
  | `show` | object | ❌ No | View Title |
  | `order` | number | ❌ No | The order of the list of views. |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `PATCH` /api/v1/db/meta/views/{viewId}/columns/{columnId}

> Update View Column


Update a column in a View


**Operation ID:** `db-view-column-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `show` | object | ❌ No | View Title |
  | `order` | number | ❌ No | The order of the list of views. |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
