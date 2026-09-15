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
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `DELETE` /api/v1/db/meta/projects/{baseId}/bases/{sourceId}

> Delete Source


Delete the source details of a given base


**Operation ID:** `source-delete`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `PATCH` /api/v1/db/meta/projects/{baseId}/bases/{sourceId}

> Update Source


Update the source details of a given base


**Operation ID:** `source-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `GET` /api/v1/db/meta/projects/{baseId}/bases/

> List Sources


Get base source list


**Operation ID:** `source-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/db/meta/projects/{baseId}/bases/

> Create Source


Create a new source on a given base


**Operation ID:** `source-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `page` | **query** |  (number) | ❌ No | - |
| `pageSize` | **query** |  (number) | ❌ No | - |
| `sort` | **query** |  (string) | ❌ No | - |
| `includeM2M` | **query** |  (boolean) | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | [Circular ref: #/components/responses/TableList] |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/meta/projects/{baseId}/{sourceId}/tables

> Create Table


Create a new table in a given Base and Source


**Operation ID:** `table-create`


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
## `POST` /api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}

> Synchronise Source Meta


Synchronise the meta data difference between NC_DB and external data sources in a given Source


**Operation ID:** `source-meta-diff-sync`


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
## `GET` /api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}

> Source Meta Diff


Get the meta data difference between NC_DB and external data sources in a given Source


**Operation ID:** `source-meta-diff-get`


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
