# Action

> Part of **nocodb**

---

## `POST` /api/v2/tables/:tableId/button/:fieldId

> Trigger a button action


Trigger a button action


**Operation ID:** `action-trigger-button`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `customRows` | array[object] | ❌ No | - |
  | `rowIds` | array[string] | ❌ No | - |
  | `customField` | object | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
