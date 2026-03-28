# DB Data Table Bulk List

> Part of **nocodb**

---

## `POST` /api/v2/tables/{tableId}/bulk/dataList

> Read Bulk Data


Read bulk data from a given table with given filters


**Operation ID:** `db-data-table-bulk-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** |  | ❌ No | [Circular ref: #/components/parameters/xc-auth] |
| `where` | **query** |  (string) | ❌ No | Extra filtering |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | [Circular ref: #/components/responses/BadRequest] |


---
