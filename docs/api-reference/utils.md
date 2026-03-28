# Utils

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/comments

> List Comments


List all comments


**Operation ID:** `utils-comment-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `row_id` | **query** |  (string) | ✅ Yes | Row ID |
| `fk_model_id` | **query** |  | ✅ Yes | Foreign Key to Model |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/meta/comments

> Comment Rows


Create a new comment in a row.


**Operation ID:** `utils-comment-row`


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
## `PATCH` /api/v1/db/meta/comment/{commentId}/

> Update Comment


Update comment


**Operation ID:** `utils-comment-update`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `DELETE` /api/v1/db/meta/comment/{commentId}/

> Delete Comment


Delete comment


**Operation ID:** `utils-comment-delete`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/db/meta/comments/count

> Count Comments


Return the number of comments in the given query.


**Operation ID:** `utils-comment-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `ids` | **query** |  | ✅ Yes | Comment IDs |
| `fk_model_id` | **query** |  | ✅ Yes | Foreign Key to Model |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/meta/connection/test

> Test DB Connection


Test the DB Connection


**Operation ID:** `utils-test-connection`


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
## `POST` /api/v1/url_to_config

> Convert JDBC URL to Config


Extract XC URL From JDBC and parse to connection config


**Operation ID:** `utils-url-to-config`


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
## `GET` /api/v1/db/meta/nocodb/info

> Get App Info


Get the application info such as authType, defaultLimit, version and etc.


**Operation ID:** `utils-app-info`


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
## `POST` /api/v1/error-reporting

> Error Reporting


Error Reporting


**Operation ID:** `utils-error-report`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|


---
## `POST` /api/v1/db/meta/axiosRequestMake

> Axios Request


Generic Axios Call


**Operation ID:** `utils-axios-request-make`


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
## `GET` /api/v1/version

> Get App Version


Get the application version


**Operation ID:** `utils-app-version`


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
## `GET` /api/v1/health

> Get Application Health Status


Get Application Health Status


**Operation ID:** `utils-app-health`


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
## `GET` /api/v2/feed

> Get Feed


**Operation ID:** `utils-feed`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `type` | **query** |  (string) | ❌ No | - |
| `per_page` | **query** |  (number) | ❌ No | - |
| `page` | **query** |  (number) | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v2/cloud-features

> Get Cloud Features


**Operation ID:** `utils-cloud-features`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `GET` /api/v1/aggregated-meta-info

> Get Aggregated Meta Info


Get Aggregated Meta Info such as tableCount, dbViewCount, viewCount and etc.


**Operation ID:** `utils-aggregated-meta-info`


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
## `GET` /api/v1/db/meta/cache

> Get Cache


Get All K/V pairs in NocoCache


**Operation ID:** `utils-cache-get`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|


---
## `DELETE` /api/v1/db/meta/cache

> Delete Cache


Delete All K/V pairs in NocoCache


**Operation ID:** `utils-cache-delete`


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
## `POST` /api/v1/command_palette

> Get command palette suggestions


Get dynamic command palette suggestions based on scope


**Operation ID:** `utils-command-palette`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
