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
| `limit` | **query** | integer | ❌ No | - |
| `offset` | **query** | integer | ❌ No | - |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of hook objects |
| `pageInfo` | object | - |
**`list`** — Array of `object` — List of hook objects




---
