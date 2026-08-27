# DB Table Webhook Logs

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/hooks/{hookId}/logs

> List Hook Logs


List the log data in a given Hook


**Operation ID:** `db-table-webhook-logs-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `limit` | **query** |  (integer) | ❌ No | - |
| `offset` | **query** |  (integer) | ❌ No | - |
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
