# Source

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/projects/{baseId}/bases/{sourceId}

> Get Source


Get the source details of a given base


**Operation ID:** `source-read`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `alias` | string | Source Name |
| `integration_title` | string | Integration Name |
| `fk_integration_id` | string | Integration Id |
| `config` | object | Source Configuration |
| `enabled` | integer | 0 or 1 |
| `id` | string | Unique Source ID |
| `inflection_column` | string | Inflection for columns |
| `inflection_table` | string | Inflection for tables |
| `is_meta` | integer | 0 or 1 |
| `is_local` | integer | 0 or 1 |
| `is_schema_readonly` | integer | 0 or 1 |
| `is_data_readonly` | integer | 0 or 1 |
| `order` | number | The order of the list of sources |
| `base_id` | string | The base ID that this source belongs to |
| `type` | string = `mysql` \| `mysql2` \| `pg` \| `snowflake` \| `sqlite3` \| `databricks` | DB Type |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `DELETE` /api/v1/db/meta/projects/{baseId}/bases/{sourceId}

> Delete Source


Delete the source details of a given base


**Operation ID:** `source-delete`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `PATCH` /api/v1/db/meta/projects/{baseId}/bases/{sourceId}

> Update Source


Update the source details of a given base


**Operation ID:** `source-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`

  - **Type:** `object`



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `GET` /api/v1/db/meta/projects/{baseId}/bases/

> List Sources


Get base source list


**Operation ID:** `source-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/db/meta/projects/{baseId}/bases/

> Create Source


Create a new source on a given base


**Operation ID:** `source-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `external` | boolean | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `alias` | string | Source Name |
| `integration_title` | string | Integration Name |
| `fk_integration_id` | string | Integration Id |
| `config` | object | Source Configuration |
| `enabled` | integer | 0 or 1 |
| `id` | string | Unique Source ID |
| `inflection_column` | string | Inflection for columns |
| `inflection_table` | string | Inflection for tables |
| `is_meta` | integer | 0 or 1 |
| `is_local` | integer | 0 or 1 |
| `is_schema_readonly` | integer | 0 or 1 |
| `is_data_readonly` | integer | 0 or 1 |
| `order` | number | The order of the list of sources |
| `base_id` | string | The base ID that this source belongs to |
| `type` | string = `mysql` \| `mysql2` \| `pg` \| `snowflake` \| `sqlite3` \| `databricks` | DB Type |



---
## `POST` /api/v1/db/meta/projects/{baseId}/bases/{sourceId}/share/erd

> share ERD view


**Operation ID:** `source-share-erd`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `DELETE` /api/v1/db/meta/projects/{baseId}/bases/{sourceId}/share/erd



**Operation ID:** `source-disable-share-erd`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/db/meta/projects/{baseId}/{sourceId}/tables

> List Tables


List all tables in a given Base and Source


**Operation ID:** `table-list`


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
| **200** |  |
| **400** |  |


---
## `POST` /api/v1/db/meta/projects/{baseId}/{sourceId}/tables

> Create Table


Create a new table in a given Base and Source


**Operation ID:** `table-create`


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
## `POST` /api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}

> Synchronise Source Meta


Synchronise the meta data difference between NC_DB and external data sources in a given Source


**Operation ID:** `source-meta-diff-sync`


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
| `msg` | string | - |



---
## `GET` /api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}

> Source Meta Diff


Get the meta data difference between NC_DB and external data sources in a given Source


**Operation ID:** `source-meta-diff-get`


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
