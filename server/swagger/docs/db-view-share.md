# DB View Share

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/tables/{tableId}/share

> List Shared Views


List all shared views in a given Table


**Operation ID:** `db-view-share-list`


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
| `list` | array[object] | List of shared view objects |
| `pageInfo` | object | Paginated Info |



---
## `POST` /api/v1/db/meta/views/{viewId}/share

> Create Shared View


Create a shared view in a given View..


**Operation ID:** `db-view-share-create`


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
| `meta` | object | Meta data passing to Shared View such as if download is allowed or not. |
| `password` | object | Password to restrict access |



---
## `PATCH` /api/v1/db/meta/views/{viewId}/share

> Update Shared View


Update a shared view in a given View..


**Operation ID:** `db-view-share-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `custom_url_path` | object | ❌ No | Custom url path |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `DELETE` /api/v1/db/meta/views/{viewId}/share

> Delete Shared View


Delete a shared view in a given View.


**Operation ID:** `db-view-share-delete`


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
