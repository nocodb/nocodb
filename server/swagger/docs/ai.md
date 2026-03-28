# Ai

> Part of **nocodb**

---

## `POST` /api/v2/ai/bases/{baseId}/utils

> AI Utils


AI Utils


**Operation ID:** `ai-utils`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `operation` | string | ❌ No | - |
  | `input` | object | ✅ Yes | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/ai/bases/{baseId}/completion

> AI Completion


AI Completion


**Operation ID:** `ai-completion`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `schema` | object | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/ai/bases/{baseId}/schema

> AI Schema


AI Schema


**Operation ID:** `ai-schema`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `operation` | string | ❌ No | - |
  | `input` | object | ✅ Yes | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/ai/workspaces/{workspaceId}/bases

> AI Schema


AI Schema


**Operation ID:** `ai-schema-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `operation` | string | ❌ No | - |
  | `input` | object | ✅ Yes | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/ai/tables/{modelId}/rows/generate

> Generate AI Data


Generate AI data for specified rows


**Operation ID:** `ai-data-generate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `modelId` | **path** | string | ✅ Yes | Model ID |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `rowIds` | array[string] | ✅ Yes | - |
  | `column` | object | ❌ No | - |
  | `preview` | boolean | ❌ No | - |
  **`column`** ✅





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/ai/tables/{modelId}/rows/fill

> Fill AI Data


Fill AI data for specified rows


**Operation ID:** `ai-data-fill`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `modelId` | **path** | string | ✅ Yes | Model ID |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `rows` | array | ❌ No | - |
  | `numRows` | number | ✅ Yes | - |
  | `generateIds` | array[string] | ✅ Yes | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/ai/tables/{modelId}/extract

> Extract Data using AI


Extract AI data from the input


**Operation ID:** `ai-data-extract`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `modelId` | **path** | string | ✅ Yes | Model ID |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `input` | string | ✅ Yes | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
