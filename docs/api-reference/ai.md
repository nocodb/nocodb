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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |


### Request Body

- **Required:** No


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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `modelId` | **path** |  (string) | ✅ Yes | Model ID |


### Request Body

- **Required:** No


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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `modelId` | **path** |  (string) | ✅ Yes | Model ID |


### Request Body

- **Required:** No


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
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `modelId` | **path** |  (string) | ✅ Yes | Model ID |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
