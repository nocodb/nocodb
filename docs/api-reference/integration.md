# Integration

> Part of **nocodb**

---

## `GET` /api/v2/meta/integrations

> List integrations


List integrations


**Operation ID:** `integration-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `type` | **query** |  | ❌ No | - |
| `includeDatabaseInfo` | **query** |  (boolean) | ❌ No | - |
| `limit` | **query** |  (number) | ❌ No | - |
| `offset` | **query** |  (number) | ❌ No | - |
| `baseId` | **query** |  (string) | ❌ No | - |
| `query` | **query** |  (string) | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/meta/integrations

> Create integration


Create integration


**Operation ID:** `integration-create`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v2/meta/integrations/{integrationId}

> Read integration


Read integration


**Operation ID:** `integration-read`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `includeConfig` | **query** |  (boolean) | ❌ No | - |
| `includeSources` | **query** |  (boolean) | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `PATCH` /api/v2/meta/integrations/{integrationId}

> Update integration


Update integration


**Operation ID:** `integration-update`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `DELETE` /api/v2/meta/integrations/{integrationId}

> Delete integration


Delete integration


**Operation ID:** `integration-delete`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `PATCH` /api/v2/meta/integrations/{integrationId}/default

> Set integration as category default


Set integration as category default


**Operation ID:** `integration-set-default`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/integrations/:integrationId/store

> Store integration


Store integration


**Operation ID:** `integration-store`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `integrationId` | **path** |  (string) | ✅ Yes | - |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v2/meta/workspaces/{workspaceId}/integrations

> List integrations


List integrations


**Operation ID:** `workspace-integration-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `type` | **query** |  | ❌ No | - |
| `includeDatabaseInfo` | **query** |  (boolean) | ❌ No | - |
| `limit` | **query** |  (number) | ❌ No | - |
| `offset` | **query** |  (number) | ❌ No | - |
| `baseId` | **query** |  (string) | ❌ No | - |
| `query` | **query** |  (string) | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/meta/workspaces/{workspaceId}/integrations

> Create integration


Create integration


**Operation ID:** `workspace-integration-create`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
