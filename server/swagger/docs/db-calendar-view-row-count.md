# DB Calendar View Row Count

> Part of **nocodb**

---

## `GET` /api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}/countByDate/

> Count of Records in Dates in Calendar View


Get the count of table view rows grouped by the dates


**Operation ID:** `db-calendar-view-row-count`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `from_date` | **query** | string | ✅ Yes | - |
| `to_date` | **query** | string | ✅ Yes | - |
| `prev_date` | **query** | string | ✅ Yes | - |
| `next_date` | **query** | string | ✅ Yes | - |
| `sort` | **query** | array | ❌ No | - |
| `where` | **query** | string | ❌ No | - |
| `limit` | **query** | integer | ❌ No | - |
| `offset` | **query** | integer | ❌ No | - |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
