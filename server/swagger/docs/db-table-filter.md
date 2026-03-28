# DB Table Filter

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/views/{viewId}/filters

> Get View Filter


Get the filter data in a given View


**Operation ID:** `db-table-filter-read`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |
| `includeAllFilters` | **query** | boolean | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of filter objects |
| `pageInfo` | object | - |
**`list`** — Array of `object` — List of filter objects




---
## `POST` /api/v1/db/meta/views/{viewId}/filters

> Create View Filter


Update the filter data in a given View


**Operation ID:** `db-table-filter-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `comparison_op` | string = `allof` \| `anyof` \| `blank` \| `btw` \| `checked` \| `empty` \| `eq` \| `ge` \| `gt` \| `gte` \| `in` \| `is` \| `isWithin` \| `isnot` \| `le` \| `like` \| `lt` \| `lte` \| `nallof` \| `nanyof` \| `nbtw` \| `neq` \| `nlike` \| `not` \| `notblank` \| `notchecked` \| `notempty` \| `notnull` \| `null` | ❌ No | Comparison Operator |
  | `comparison_sub_op` | string = `daysAgo` \| `daysFromNow` \| `exactDate` \| `nextMonth` \| `nextNumberOfDays` \| `nextWeek` \| `nextYear` \| `oneMonthAgo` \| `oneMonthFromNow` \| `oneWeekAgo` \| `oneWeekFromNow` \| `pastMonth` \| `pastNumberOfDays` \| `pastWeek` \| `pastYear` \| `today` \| `tomorrow` \| `yesterday` | ❌ No | Comparison Sub-Operator |
  | `fk_column_id` | object | ❌ No | Foreign Key to Column |
  | `fk_widget_id` | object | ❌ No | Foreign Key to Widget |
  | `fk_parent_id` | object | ❌ No | Belong to which filter ID |
  | `is_group` | object | ❌ No | Is this filter grouped? |
  | `logical_op` | string = `and` \| `not` \| `or` | ❌ No | Logical Operator |
  | `value` | object | ❌ No | The filter value. Can be NULL for some operators. |
  | `enabled` | object | ❌ No | Whether this filter is enabled. Disabled filters are skipped during evaluation. |
  | `fk_level_id` | object | ❌ No | Foreign Key to List View Level |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/filters/{filterId}

> Get Filter


Get the filter data with a given Filter ID


**Operation ID:** `db-table-filter-get`


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
## `PATCH` /api/v1/db/meta/filters/{filterId}

> Update Filter


Update the filter data with a given Filter ID


**Operation ID:** `db-table-filter-update`


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
## `DELETE` /api/v1/db/meta/filters/{filterId}

> Delete Filter


Delete the filter data with a given Filter ID


**Operation ID:** `db-table-filter-delete`


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
## `GET` /api/v1/db/meta/filters/{filterGroupId}/children

> Get Filter Group Children


Get Filter Group Children of a given group ID


**Operation ID:** `db-table-filter-children-read`


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
