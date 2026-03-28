# Base

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/projects/{baseId}/info

> Get Base info


Get info such as node version, arch, platform, is docker, rootdb and package version of a given base


**Operation ID:** `base-meta-get`


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
## `GET` /api/v1/db/meta/projects/{baseId}/visibility-rules

> Get UI ACL


Hide / show views based on user role


**Operation ID:** `base-model-visibility-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `includeM2M` | **query** |  (boolean) | ❌ No | - |
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/db/meta/projects/{baseId}/visibility-rules

> Create UI ACL


Hide / show views based on user role


**Operation ID:** `base-model-visibility-set`


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
## `GET` /api/v1/db/meta/projects/

> List Projects


List all base meta data


**Operation ID:** `base-list`


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
## `POST` /api/v1/db/meta/projects/

> Create Base


Create a new base


**Operation ID:** `base-create`


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
## `POST` /api/v1/db/meta/duplicate/{baseId}/{sourceId}

> Duplicate Base Source


Duplicate a base


**Operation ID:** `base-source-duplicate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |
| `baseId` | **path** |  (string) | ✅ Yes | Unique Base ID |
| `sourceId` | **path** |  (string) | ❌ No | Unique Source ID |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/db/meta/duplicate/{baseId}

> Duplicate Base


Duplicate a base


**Operation ID:** `base-duplicate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |
| `baseId` | **path** |  (string) | ✅ Yes | Unique Base ID |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `GET` /api/v1/db/meta/projects/{baseId}

> Get Base


Get the info of a given base


**Operation ID:** `base-read`


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
## `DELETE` /api/v1/db/meta/projects/{baseId}

> Delete Base


Delete the given base


**Operation ID:** `base-delete`


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
## `PATCH` /api/v1/db/meta/projects/{baseId}

> Update Base


Update the given base


**Operation ID:** `base-update`


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
## `PATCH` /api/v1/db/meta/projects/{baseId}/user

> Base user meta update


**Operation ID:** `base-user-meta-update`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/db/meta/projects/{baseId}/shared

> Get Base Shared Base


Get Base Shared Base


**Operation ID:** `base-shared-base-get`


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
## `DELETE` /api/v1/db/meta/projects/{baseId}/shared

> Delete Base Shared Base


Delete Base Shared Base


**Operation ID:** `base-shared-base-disable`


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
## `POST` /api/v1/db/meta/projects/{baseId}/shared

> Create Base Shared Base


Create Base Shared Base


**Operation ID:** `base-shared-base-create`


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
## `PATCH` /api/v1/db/meta/projects/{baseId}/shared

> Update Base Shared Base


Update Base Shared Base


**Operation ID:** `base-shared-base-update`


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
## `GET` /api/v1/db/meta/projects/{baseId}/cost

> Base Cost


Calculate the Base Cost


**Operation ID:** `base-cost`


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
## `POST` /api/v2/meta/duplicate/{workspaceId}/shared/{sharedBaseId}

> Duplicate Shared Base


Duplicate a shared base


**Operation ID:** `base-duplicate-shared`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `workspaceId` | **path** |  (string) | ✅ Yes | Unique Workspace ID |
| `sharedBaseId` | **path** |  | ✅ Yes | Unique Shared Base ID |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/meta/projects/{baseId}/meta-diff

> Sync Meta


Synchronise the meta data difference between NC_DB and external data sources 


**Operation ID:** `base-meta-diff-sync`


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
## `GET` /api/v1/db/meta/projects/{baseId}/meta-diff

> Meta Diff


Get the meta data difference between NC_DB and external data sources 


**Operation ID:** `base-meta-diff-get`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/db/meta/projects/{baseId}/has-empty-or-null-filters

> List Empty &amp; Null Filter


Check if a base contains empty and null filters. Used in &#x60;Show NULL and EMPTY in Filter&#x60; in Base Setting.


**Operation ID:** `base-has-empty-or-null-filters`


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
