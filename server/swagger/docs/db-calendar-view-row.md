# DB Calendar View Row

> Part of **nocodb**

---

## `GET` /api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}

> List rows in Calendar View of a Table


List all rows in Calendar View of a Table


**Operation ID:** `db-calendar-view-row-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `from_date` | **query** | string | ✅ Yes | - |
| `prev_date` | **query** | string | ✅ Yes | - |
| `next_date` | **query** | string | ✅ Yes | - |
| `to_date` | **query** | string | ✅ Yes | - |
| `fields` | **query** | array | ❌ No | - |
| `sort` | **query** | array | ❌ No | - |
| `where` | **query** | string | ❌ No | - |
| `nested` | **query** | object | ❌ No | Query params for nested data |
| `offset` | **query** | number | ❌ No | - |
| `` | **** | object | ❌ No | - |



---
## `GET` /api/v1/db/public/calendar-view/{sharedViewUuid}

> List rows in Calendar View of a Table


List all rows in Calendar View of a Table


**Operation ID:** `public-data-calendar-row-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `from_date` | **query** | string | ✅ Yes | - |
| `to_date` | **query** | string | ✅ Yes | - |
| `prev_date` | **query** | string | ✅ Yes | - |
| `next_date` | **query** | string | ✅ Yes | - |
| `fields` | **query** | array | ❌ No | - |
| `sort` | **query** | array | ❌ No | - |
| `where` | **query** | string | ❌ No | - |
| `nested` | **query** | object | ❌ No | Query params for nested data |
| `offset` | **query** | number | ❌ No | - |
| `` | **** | object | ❌ No | - |



---
