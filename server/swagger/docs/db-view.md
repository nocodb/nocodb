# DB View

> Part of **nocodb**

---

## `GET` /api/v1/db/meta/tables/{tableId}/views

> List Views


List all views in a given Table.


**Operation ID:** `db-view-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of view objects |
| `pageInfo` | object | Paginated Info |
**`list`** — Array of `object` — List of view objects

  **`view`** ❌ — Model for Form

    **`banner_image_url`** ❌ — Banner Image URL

    **`columns`** — Array of `object` — Form Columns




---
## `PATCH` /api/v1/db/meta/views/{viewId}

> Update View


Update the view with the given view Id.


**Operation ID:** `db-view-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `title` | string | ❌ No | View Title |
  | `description` | object | ❌ No | Description of the view. |
  | `uuid` | string | ❌ No | View UUID. Used in Shared View. |
  | `password` | string | ❌ No | View Password. Used in Shared View. |
  | `lock_type` | string = `collaborative` \| `locked` \| `personal` | ❌ No | Lock type of View. |
  | `meta` | object | ❌ No | Meta info used in View. |
  | `order` | number | ❌ No | The order of the list of views. |
  | `show_system_fields` | object | ❌ No | Should this view show system fields? |
  | `owned_by` | object | ❌ No | ID of view owner user |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `DELETE` /api/v1/db/meta/views/{viewId}

> Delete View


Delete the view with the given view Id.


**Operation ID:** `db-view-delete`


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
## `GET` /api/v1/db/meta/views/{viewId}/row-color

> Get row color info


Get the row color info from view.


**Operation ID:** `get-view-row-color`


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
## `DELETE` /api/v1/db/meta/views/{viewId}/row-color

> Delete row color info


Delete the row color info from view.


**Operation ID:** `delete-view-row-color`


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
## `POST` /api/v1/db/meta/views/{viewId}/row-color-select

> Set view row color select


**Operation ID:** `view-row-color-select-add`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_column_id` | string | ✅ Yes | Column ID to use for row coloring |
  | `is_set_as_background` | boolean | ✅ Yes | Whether to use the color as background |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v1/db/meta/views/{viewId}/row-color-conditions

> Add view row color condition


**Operation ID:** `view-row-color-condition-add`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `color` | string | ✅ Yes | Color to apply to matching rows |
  | `is_set_as_background` | boolean | ✅ Yes | Whether to use the color as background |
  | `nc_order` | number | ✅ Yes | Order of the condition |
  | `filter` | object | ✅ Yes | - |
  **`filter`** ✅





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `PATCH` /api/v1/db/meta/views/{viewId}/row-color-conditions/{id}

> Update view row color condition


**Operation ID:** `view-row-color-condition-update`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `color` | string | ✅ Yes | Color to apply to matching rows |
  | `is_set_as_background` | boolean | ✅ Yes | Whether to use the color as background |
  | `nc_order` | number | ✅ Yes | Order of the condition |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `DELETE` /api/v1/db/meta/views/{viewId}/row-color-conditions/{id}

> Delete view row color condition


**Operation ID:** `view-row-color-condition-delete`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v1/db/meta/views/{viewId}/show-all

> Show All Columns In View


Show All Columns in a given View


**Operation ID:** `db-view-show-all-column`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `ignoreIds` | **query** | array | ❌ No | - |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `POST` /api/v1/db/meta/views/{viewId}/hide-all

> Hide All Columns In View


Hide All Columns in a given View


**Operation ID:** `db-view-hide-all-column`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `ignoreIds` | **query** | array | ❌ No | - |
| `` | **** | object | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `POST` /api/v1/db/meta/tables/{tableId}/grids

> Create Grid View


Create a new grid view in a given Table


**Operation ID:** `db-view-grid-create`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `title` | string | ✅ Yes | View Title |
  | `type` | number | ❌ No | View Type |
  | `copy_from_id` | object | ❌ No | ID of view to be copied from. Used in Copy View. |
  | `fk_grp_col_id` | object | ❌ No | Foreign Key to Grouping Column. Used in creating Kanban View. |
  | `fk_geo_data_col_id` | object | ❌ No | Foreign Key to Geo Data Column. Used in creating Map View. |
  | `calendar_range` | null | ❌ No | Calendar Range or Null |
  | `description` | object | ❌ No | Description of the view. |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `POST` /api/v1/db/meta/tables/{tableId}/forms

> Create Form View


Create a new form view in a given Table


**Operation ID:** `db-view-form-create`


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
## `PATCH` /api/v1/db/meta/forms/{formViewId}

> Update Form View


Update the form data by Form ID


**Operation ID:** `db-view-form-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `banner_image_url` | object | ❌ No | Model for Attachment Request |
  | `email` | object | ❌ No | Email to sned after form is submitted |
  | `heading` | string | ❌ No | The heading of the form |
  | `logo_url` | object | ❌ No | - |
  | `meta` | object | ❌ No | Meta Info for this view |
  | `redirect_after_secs` | object | ❌ No | The numbers of seconds to redirect after form submission |
  | `redirect_url` | object | ❌ No | URL to redirect after submission |
  | `show_blank_form` | object | ❌ No | Show `Blank Form` after 5 seconds |
  | `subheading` | object | ❌ No | The subheading of the form |
  | `submit_another_form` | object | ❌ No | Show `Submit Another Form` button |
  | `success_msg` | object | ❌ No | Custom message after the form is successfully submitted |
  | `starts_at` | object | ❌ No | Form start date. Before this date, the form shows a countdown and does not accept submissions. |
  | `expires_at` | object | ❌ No | Form expiration date. After this date, the form will no longer accept submissions. |
  **`banner_image_url`** ❌ — Model for Attachment Request





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/forms/{formViewId}

> Get Form


Get the form data by Form ID


**Operation ID:** `db-view-form-read`


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
## `PATCH` /api/v1/db/meta/form-columns/{formViewColumnId}

> Update Form Column


Update the form column(s) by Form View Column ID


**Operation ID:** `db-view-form-column-update`


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

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `description` | object | Form Column Description |
| `help` | object | Form Column Help Text (Not in use) |
| `label` | object | Form Column Label |
| `meta` | object | Meta Info |
| `order` | number | The order among all the columns in the form |
| `required` | object | Is this form column required in submission? |
| `show` | object | Is this column shown in Form? |



---
## `PATCH` /api/v1/db/meta/grids/{viewId}

> Update Grid View


Update Grid View


**Operation ID:** `db-view-grid-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `row_height` | number | ❌ No | Row Height |
  | `meta` | object | ❌ No | Meta Info for grid view |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/grids/{gridId}/grid-columns

> List Grid Columns


List all columns in the given Grid


**Operation ID:** `db-view-grid-columns-list`


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
## `PATCH` /api/v1/db/meta/grid-columns/{columnId}

> Update Grid Column


Update grid column(s) in the given Grid


**Operation ID:** `db-view-grid-column-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_column_id` | object | ❌ No | Foreign Key to Column |
  | `help` | string | ❌ No | - |
  | `label` | string | ❌ No | The label of the column |
  | `width` | string | ❌ No | The width of the column |
  | `group_by` | object | ❌ No | Group By |
  | `group_by_order` | number | ❌ No | Group By Order |
  | `group_by_sort` | object | ❌ No | Group By Sort |
  | `aggregation` | object | ❌ No | Aggregation |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `POST` /api/v1/db/meta/tables/{tableId}/galleries

> Create Gallery View


**Operation ID:** `db-view-gallery-create`


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
## `PATCH` /api/v1/db/meta/galleries/{galleryViewId}

> Update Gallery View


Update the Gallery View data with Gallery ID


**Operation ID:** `db-view-gallery-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_cover_image_col_id` | object | ❌ No | The id of the column that contains the cover image |
  | `meta` | object | ❌ No | Meta Info |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/galleries/{galleryViewId}

> Get Gallery View


Get the Gallery View data with Gallery ID


**Operation ID:** `db-view-gallery-read`


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
## `POST` /api/v1/db/meta/tables/{tableId}/kanbans

> Create Kanban View


Create a new Kanban View


**Operation ID:** `db-view-kanban-create`


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
## `PATCH` /api/v1/db/meta/kanbans/{kanbanViewId}

> Update Kanban View


Update the Kanban View data with Kanban ID


**Operation ID:** `db-view-kanban-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_grp_col_id` | object | ❌ No | Foreign Key to Grouping Field Column |
  | `fk_cover_image_col_id` | object | ❌ No | Foreign Key to Cover Image Column |
  | `meta` | object | ❌ No | Meta Info |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/kanbans/{kanbanViewId}

> Get Kanban View


Get the Kanban View data by Kanban ID


**Operation ID:** `db-view-kanban-read`


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
## `POST` /api/v1/db/meta/tables/{tableId}/maps

> Create Map View


Create a new Map View


**Operation ID:** `db-view-map-create`


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
## `PATCH` /api/v1/db/meta/maps/{mapViewId}

> Update Map View


Update the Map View data by Map ID


**Operation ID:** `db-view-map-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_geo_data_col_id` | string | ❌ No | Foreign Key to GeoData Column |
  | `meta` | object | ❌ No | Meta data for this view |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/maps/{mapViewId}

> Get Map View


Get the Map View data by Map ID


**Operation ID:** `db-view-map-read`


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
## `POST` /api/v1/db/meta/tables/{tableId}/calendars

> Create Calendar View


Create a new Calendar View


**Operation ID:** `db-view-calendar-create`


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
## `PATCH` /api/v1/db/meta/calendars/{calendarViewId}

> Update Calendar View


Update the Calendar View data with Calendar ID


**Operation ID:** `db-view-calendar-update`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `` | **** | object | ❌ No | - |


### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_cover_image_col_id` | object | ❌ No | Foreign Key to Cover Image Column |
  | `title` | string | ❌ No | Calendar Title |
  | `calendar_range` | array[object] | ❌ No | Calendar Columns |
  | `meta` | object | ❌ No | Meta Info |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** |  |


---
## `GET` /api/v1/db/meta/calendars/{calendarViewId}

> Get Calendar View


Get the Calendar View data by Calendar ID


**Operation ID:** `db-view-calendar-read`


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
