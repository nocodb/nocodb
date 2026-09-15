# DB Table Webhook

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/tables/{tableId}/hooks

> List Table Hooks


List all hook records in the given Table


**Operation ID:** `db-table-webhook-list`


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
## `POST` /api/v1/db/meta/tables/{tableId}/hooks

> Create Table Hook


Create a hook in the given table


**Operation ID:** `db-table-webhook-create`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
## `POST` /api/v1/db/meta/tables/{tableId}/hooks/test

> Test Hook


Test the hook in the given Table


**Operation ID:** `db-table-webhook-test`


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
## `GET` /api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{event}/{operation}/{version}

> Get Sample Hook Payload


Get the sample hook payload


**Operation ID:** `db-table-webhook-sample-payload-get`


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
## `PATCH` /api/v1/db/meta/hooks/{hookId}

> Update Hook


Update the exsiting hook by its ID


**Operation ID:** `db-table-webhook-update`


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
## `DELETE` /api/v1/db/meta/hooks/{hookId}

> Delete Hook


Delete the exsiting hook by its ID


**Operation ID:** `db-table-webhook-delete`


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
## `POST` /api/v2/meta/hooks/{hookId}/trigger/{rowId}

> Trigger Manual Hook


Trigger the manual WebHook


**Operation ID:** `db-table-webhook-trigger`


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
