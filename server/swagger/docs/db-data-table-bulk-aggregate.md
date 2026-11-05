# DB Data Table Bulk Aggregate

> Part of **nocodb**

---

## `POST` /api/v2/tables/{tableId}/bulk/aggregate

> Read Bulk Aggregated Data


Read bulk aggregated data from a given table with given filters


**Operation ID:** `db-data-table-bulk-aggregate`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `where` | **query** | string | ❌ No | Extra filtering |
| `filterArrJson` | **query** | string | ❌ No | Used for multiple filter queries |
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
