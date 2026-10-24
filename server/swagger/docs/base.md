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
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `Node` | string | Node version |
| `Arch` | string | Architecture type |
| `Platform` | string | Platform type |
| `Docker` | boolean | Is docker |
| `Database` | string | Database type |
| `ProjectOnRootDB` | boolean | Is base on rootdb |
| `RootDB` | string | Root database type |
| `PackageVersion` | string | Package version |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `GET` /api/v1/db/meta/projects/{baseId}/visibility-rules

> Get UI ACL


Hide / show views based on user role


**Operation ID:** `base-model-visibility-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `includeM2M` | **query** | boolean | ❌ No | - |
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
## `POST` /api/v1/db/meta/projects/{baseId}/visibility-rules

> Create UI ACL


Hide / show views based on user role


**Operation ID:** `base-model-visibility-set`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`

  **Array of:** object

  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `id` | string | ❌ No | - |
  | `disabled` | object | ❌ No | - |
  **`disabled`** ❌





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `GET` /api/v1/db/meta/projects/

> List Projects


List all base meta data


**Operation ID:** `base-list`


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
| `list` | array[object] | List of Base Models |
| `pageInfo` | object | Model for Paginated |
**`list`** — Array of `object` — List of Base Models

  **`sources`** — Array of `object` — List of source models

  **`permissions`** — Array of `object` — List of permissions for the base

    **`subjects`** — Array of `object` — List of subjects (users or groups) for the permission

**`pageInfo`** ✅ — Model for Paginated



**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/db/meta/projects/

> Create Base


Create a new base


**Operation ID:** `base-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `sources` | array[object] | ❌ No | Array of Bases |
  | `color` | string | ❌ No | Primary Theme Color |
  | `description` | string | ❌ No | Base Description |
  | `title` | string | ✅ Yes | Base Title |
  | `status` | string | ❌ No | Base Status |
  | `type` | string = `database` \| `documentation` \| `dashboard` | ❌ No | - |
  | `meta` | null | ❌ No | Base Meta |
  | `fk_workspace_id` | string | ❌ No | Workspace ID |
  | `external` | boolean | ❌ No | If true, the base will us an external database else it will use the root database |
  **`sources`** — Array of `object` — Array of Bases





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
## `POST` /api/v1/db/meta/duplicate/{baseId}/{sourceId}

> Duplicate Base Source


Duplicate a base


**Operation ID:** `base-source-duplicate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |
| `baseId` | **path** | string | ✅ Yes | Unique Base ID |
| `sourceId` | **path** | string | ❌ No | Unique Source ID |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `options` | object | ❌ No | - |
  | `base` | object | ❌ No | - |
  **`options`** ❌





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `name` | string | - |
| `id` | string | - |
| `base_id` | string | - |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `POST` /api/v1/db/meta/duplicate/{baseId}

> Duplicate Base


Duplicate a base


**Operation ID:** `base-duplicate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |
| `baseId` | **path** | string | ✅ Yes | Unique Base ID |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `options` | object | ❌ No | - |
  | `base` | object | ❌ No | - |
  **`options`** ❌





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `name` | string | - |
| `id` | string | - |


**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `msg` | string | - |



---
## `GET` /api/v1/db/meta/projects/{baseId}

> Get Base


Get the info of a given base


**Operation ID:** `base-read`


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
## `DELETE` /api/v1/db/meta/projects/{baseId}

> Delete Base


Delete the given base


**Operation ID:** `base-delete`


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
## `PATCH` /api/v1/db/meta/projects/{baseId}

> Update Base


Update the given base


**Operation ID:** `base-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** | string | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `color` | string | ❌ No | Primary Theme Color |
  | `meta` | null | ❌ No | Base Meta |
  | `title` | string | ❌ No | Base Title |
  | `status` | string | ❌ No | Base Status |
  | `order` | number | ❌ No | The order of the list of projects. |
  



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
## `PATCH` /api/v1/db/meta/projects/{baseId}/user

> Base user meta update


**Operation ID:** `base-user-meta-update`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `starred` | integer | ❌ No | 0 or 1 |
  | `order` | number | ❌ No | The order among the bases |
  | `hidden` | integer | ❌ No | 0 or 1 |
  



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
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `uuid` | string (uuid) | - |
| `url` | string (uri) | - |
| `roles` | string | - |
| `fk_custom_url_id` | string | ID of custom url |



---
## `DELETE` /api/v1/db/meta/projects/{baseId}/shared

> Delete Base Shared Base


Delete Base Shared Base


**Operation ID:** `base-shared-base-disable`


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
## `POST` /api/v1/db/meta/projects/{baseId}/shared

> Create Base Shared Base


Create Base Shared Base


**Operation ID:** `base-shared-base-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `roles` | string = `commenter` \| `editor` \| `viewer` | ❌ No | The role given the target user |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `uuid` | object | - |
| `roles` | object | - |



---
## `PATCH` /api/v1/db/meta/projects/{baseId}/shared

> Update Base Shared Base


Update Base Shared Base


**Operation ID:** `base-shared-base-update`


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

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `uuid` | string (uuid) | - |
| `url` | string (uri) | - |
| `roles` | string | - |
| `fk_custom_url_id` | object | ID of custom url |



---
## `GET` /api/v1/db/meta/projects/{baseId}/cost

> Base Cost


Calculate the Base Cost


**Operation ID:** `base-cost`


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
## `POST` /api/v2/meta/duplicate/{workspaceId}/shared/{sharedBaseId}

> Duplicate Shared Base


Duplicate a shared base


**Operation ID:** `base-duplicate-shared`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `workspaceId` | **path** | string | ✅ Yes | Unique Workspace ID |
| `sharedBaseId` | **path** | object | ✅ Yes | Unique Shared Base ID |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `options` | object | ❌ No | - |
  | `base` | object | ❌ No | - |
  **`options`** ❌





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `name` | string | - |
| `id` | string | - |



---
## `POST` /api/v1/db/meta/projects/{baseId}/meta-diff

> Sync Meta


Synchronise the meta data difference between NC_DB and external data sources


**Operation ID:** `base-meta-diff-sync`


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
## `GET` /api/v1/db/meta/projects/{baseId}/meta-diff

> Meta Diff


Get the meta data difference between NC_DB and external data sources


**Operation ID:** `base-meta-diff-get`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/projects/{baseId}/has-empty-or-null-filters

> List Empty &amp; Null Filter


Check if a base contains empty and null filters. Used in `Show NULL and EMPTY in Filter` in Base Setting.


**Operation ID:** `base-has-empty-or-null-filters`


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
