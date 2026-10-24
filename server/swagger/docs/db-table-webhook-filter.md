# DB Table Webhook Filter

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/hooks/{hookId}/filters

> Get Hook Filter


Get the filter data in a given Hook


**Operation ID:** `db-table-webhook-filter-read`


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
## `POST` /api/v1/db/meta/hooks/{hookId}/filters

> Create Hook Filter


Create filter(s) in a given Hook


**Operation ID:** `db-table-webhook-filter-create`


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
