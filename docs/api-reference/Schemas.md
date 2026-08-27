# Data Schemas

> **nocodb** — Schema Definitions

---

## `ApiToken`

> Model for API Token


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ No | Model for ID |
| `fk_user_id` | `string` | ❌ No | Model for ID |
| `description` | `string` | ❌ No | API Token Description |
| `token` | `string` | ❌ No | API Token |




---
## `ApiTokenReq`

> Model for API Token Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `description` | `string` | ❌ No | Description of the API token |




---
## `ApiTokenList`

> Model for API Token List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [object] | ✅ Yes | List of api token objects |
| `pageInfo` | `object` | ✅ Yes | Model for Paginated |


**Required fields:** `list`, `pageInfo`



---
## `Attachment`

> Model for Attachment


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | object | ❌ No | Data for uploading |
| `mimetype` | `string` | ❌ No | The mimetype of the attachment |
| `path` | `string` | ❌ No | File Path |
| `size` | `number` | ❌ No | Attachment Size |
| `title` | `string` | ❌ No | The title of the attachment. Used in UI. |
| `url` | `string` | ❌ No | Attachment URL |




---
## `AttachmentReq`

> Model for Attachment Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mimetype` | `string` | ❌ No | The mimetype of the attachment |
| `path` | `string` | ❌ No | The file path of the attachment |
| `size` | `number` | ❌ No | The size of the attachment |
| `title` | `string` | ❌ No | The title of the attachment used in UI |
| `url` | `string` | ❌ No | Attachment URL to be uploaded via upload-by-url |
| `fileName` | `string` | ❌ No | The name of the attachment file name |




---
## `AttachmentRes`

> Model for Attachment Response






---
## `FileReq`

> Model for File Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mimetype` | `string` | ❌ No | The mimetype of the file |
| `fieldname` | `string` | ❌ No | The name of the input used to upload the file |
| `originalname` | `string` | ❌ No | The original name of the file |
| `size` | `number` | ❌ No | The size of the file |
| `encoding` | `string` | ❌ No | The encoding of the file |
| `buffer` | object | ❌ No | An buffer array containing the file content |




---
## `Audit`

> Model for Audit


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `user` | `string` | ❌ No | The user name performing the action |
| `display_name` | `string` | ❌ No | The display name of user performing the action |
| `ip` | `string` | ❌ No | IP address from the user |
| `source_id` | `string` | ❌ No | Source ID in where action is performed |
| `base_id` | `string` | ❌ No | Base ID in where action is performed |
| `fk_model_id` | `string` | ❌ No | Model ID in where action is performed |
| `row_id` | `string` | ❌ No | Row ID |
| `op_type` | `string` | ❌ No | Operation Type |
| `op_sub_type` | `string` | ❌ No | Operation Sub Type |
| `status` | `string` | ❌ No | Audit Status |
| `description` | `string` | ❌ No | Description of the action |
| `details` | `string` | ❌ No | Detail |
| `version` | `number` | ❌ No | Version of the audit |




---
## `AuditRowUpdateReq`

> Model for Audit Row Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `column_name` | `string` | ❌ No | Column Name |
| `fk_model_id` | `string` | ❌ No | Foreign Key to Model |
| `row_id` | `string` | ❌ No | Row ID |
| `prev_value` | object | ❌ No | The previous value before the action |
| `value` | object | ❌ No | The current value after the action |




---
## `Source`

> Model for Source


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `alias` | object | ❌ No | Source Name |
| `integration_title` | object | ❌ No | Integration Name |
| `fk_integration_id` | object | ❌ No | Integration Id |
| `config` | object | ❌ No | Source Configuration |
| `enabled` | object | ❌ No | Model for Bool |
| `id` | `string` | ❌ No | Unique Source ID |
| `inflection_column` | `string` | ❌ No | Inflection for columns |
| `inflection_table` | `string` | ❌ No | Inflection for tables |
| `is_meta` | object | ❌ No | Model for Bool |
| `is_local` | object | ❌ No | Model for Bool |
| `is_schema_readonly` | object | ❌ No | Model for Bool |
| `is_data_readonly` | object | ❌ No | Model for Bool |
| `order` | `number` | ❌ No | The order of the list of sources |
| `base_id` | `string` | ❌ No | The base ID that this source belongs to |
| `type` | `string` | ❌ No | DB Type |




---
## `Integration`

> Model for Integration


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | object | ❌ No | Source Name - Default BASE will be null by default |
| `config` | object | ❌ No | Source Configuration |
| `enabled` | object | ❌ No | Is this Intgration enabled |
| `id` | `string` | ❌ No | Unique Integration ID |
| `fk_workspace_id` | `string` | ❌ No | Unique Workspace ID |
| `order` | `number` | ❌ No | The order of the list of sources |
| `base_id` | `string` | ❌ No | The base ID that this source belongs to |
| `is_private` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `is_default` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `type` | object | ❌ No | [Circular ref: #/components/schemas/Integrations] |
| `sub_type` | `string` | ❌ No | DB Type |
| `created_by` | `string` | ❌ No | DB Type |




---
## `BaseList`

> Model for Source List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of source objects |
| `pageInfo` | object | ✅ Yes | Paginated Info |


**Required fields:** `list`, `pageInfo`



---
## `BaseReq`

> Model for Source Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `alias` | `string` | ❌ No | Source Name - Default BASE will be null by default |
| `config` | object | ❌ No | Source Configuration |
| `inflection_column` | `string` | ❌ No | Inflection for columns |
| `inflection_table` | `string` | ❌ No | Inflection for tables |
| `is_meta` | `boolean` | ❌ No | Is the data source connected externally |
| `is_local` | `boolean` | ❌ No | Is the data source minimal db |
| `is_schema_readonly` | object | ❌ No | Model for Bool |
| `is_data_readonly` | object | ❌ No | Model for Bool |
| `type` | `string` | ❌ No | DB Type |
| `fk_integration_id` | `string` | ❌ No | - |




---
## `Integrations`

> Integration Type


**Type:** `string`





---
## `IntegrationReq`

> Model for Integration Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ✅ Yes | Integration Name - Default BASE will be null by default |
| `config` | object | ✅ Yes | Source Configuration |
| `meta` | object | ❌ No | Integration metas |
| `type` | object | ✅ Yes | [Circular ref: #/components/schemas/Integrations] |
| `sub_type` | `string` | ❌ No | Sub Type |
| `copy_from_id` | object | ❌ No | ID of integration to be copied from. Used in Copy Integration. |


**Required fields:** `title`, `config`, `type`



---
## `Bool`

> Model for Bool






---
## `Column`

> Model for Column


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ai` | object | ❌ No | Is Auto-Increment? |
| `au` | object | ❌ No | Auto Update Timestamp |
| `description` | object | ❌ No | Column Description |
| `source_id` | `string` | ❌ No | Source ID that this column belongs to |
| `cc` | `string` | ❌ No | Column Comment |
| `cdf` | object | ❌ No | Column Default |
| `clen` | object | ❌ No | Character Maximum Length |
| `colOptions` | object | ❌ No | Column Options |
| `column_name` | `string` | ❌ No | Column Name |
| `cop` | `string` | ❌ No | Column Ordinal Position |
| `csn` | object | ❌ No | Character Set Name |
| `ct` | `string` | ❌ No | Column Type |
| `deleted` | object | ❌ No | Is Deleted? |
| `dt` | `string` | ❌ No | Data Type in DB |
| `dtx` | `string` | ❌ No | Data Type X |
| `dtxp` | object | ❌ No | Data Type X Precision |
| `dtxs` | object | ❌ No | Data Type X Scale |
| `fk_model_id` | `string` | ❌ No | Model ID that this column belongs to |
| `id` | object | ❌ No | Unique ID |
| `meta` | object | ❌ No | Meta Info |
| `np` | object | ❌ No | Numeric Precision |
| `ns` | object | ❌ No | Numeric Scale |
| `order` | `number` | ❌ No | The order of the list of columns |
| `pk` | object | ❌ No | Is Primary Key? |
| `pv` | object | ❌ No | Is Primary Value? |
| `rqd` | object | ❌ No | Is Required? |
| `system` | object | ❌ No | Is System Column? |
| `title` | `string` | ❌ No | Column Title |
| `uidt` | `string` | ❌ No | The data type in UI |
| `un` | object | ❌ No | Is Unsigned? |
| `unique` | object | ❌ No | Is unique? |
| `visible` | object | ❌ No | Is Visible? |
| `readonly` | object | ❌ No | Is this column readonly? |




---
## `ColumnList`

> Model for Column List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of column objects |
| `pageInfo` | object | ✅ Yes | [Circular ref: #/components/schemas/Paginated] |


**Required fields:** `list`, `pageInfo`



---
## `ColumnReq`

> Model for Column Request


**Type:** `object`





---
## `CommentReq`

> Model for Comment Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `comment` | `string` | ❌ No | Description for the target row |
| `fk_model_id` | `string` | ✅ Yes | Foreign Key to Model |
| `row_id` | `string` | ✅ Yes | Row ID |


**Required fields:** `fk_model_id`, `row_id`



---
## `CommentUpdateReq`

> Model for Comment Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `comment` | `string` | ❌ No | Description for the target row |
| `fk_model_id` | `string` | ❌ No | Foreign Key to Model |




---
## `Filter`

> Model for Filter


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | `string` | ❌ No | Unqiue Source ID |
| `children` | `array` [] | ❌ No | Children filters. Available when the filter is grouped. |
| `comparison_op` | object | ❌ No | Comparison Operator |
| `comparison_sub_op` | object | ❌ No | Comparison Sub-Operator |
| `fk_parent_column_id` | object | ❌ No | Foreign Key to parent column |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_hook_id` | object | ❌ No | Foreign Key to Hook |
| `fk_model_id` | object | ❌ No | Foreign Key to Model |
| `fk_parent_id` | object | ❌ No | Foreign Key to parent group. |
| `fk_view_id` | object | ❌ No | Foreign Key to View |
| `fk_value_col_id` | object | ❌ No | Foreign Key to dynamic value Column |
| `fk_link_col_id` | object | ❌ No | Foreign Key to Link Column |
| `fk_rls_policy_id` | object | ❌ No | Foreign Key to RLS Policy |
| `fk_button_col_id` | object | ❌ No | Foreign Key to Button Column |
| `id` | object | ❌ No | Unique ID |
| `is_group` | object | ❌ No | Is this filter grouped? |
| `logical_op` | `string` | ❌ No | Logical Operator |
| `base_id` | `string` | ❌ No | Unique Base ID |
| `value` | object | ❌ No | The filter value. Can be NULL for some operators. |
| `order` | `number` | ❌ No | The order of the filter |
| `enabled` | object | ❌ No | Whether this filter is enabled. Disabled filters are skipped during evaluation. |
| `fk_level_id` | object | ❌ No | Foreign Key to List View Level |




---
## `FilterList`

> Model for Filter List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of filter objects |
| `pageInfo` | object | ✅ Yes | [Circular ref: #/components/schemas/Paginated] |


**Required fields:** `list`, `pageInfo`



---
## `FilterLogList`

> Model for Filter Log List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of filter objects |
| `pageInfo` | object | ✅ Yes | [Circular ref: #/components/schemas/Paginated] |


**Required fields:** `list`, `pageInfo`



---
## `FilterReq`

> Model for Filter Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `comparison_op` | object | ❌ No | Comparison Operator |
| `comparison_sub_op` | object | ❌ No | Comparison Sub-Operator |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_widget_id` | object | ❌ No | Foreign Key to Widget |
| `fk_parent_id` | object | ❌ No | Belong to which filter ID |
| `is_group` | object | ❌ No | Is this filter grouped? |
| `logical_op` | `string` | ❌ No | Logical Operator |
| `value` | object | ❌ No | The filter value. Can be NULL for some operators. |
| `enabled` | object | ❌ No | Whether this filter is enabled. Disabled filters are skipped during evaluation. |
| `fk_level_id` | object | ❌ No | Foreign Key to List View Level |




---
## `Follower`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_follower_id` | `string` | ❌ No | - |




---
## `Form`

> Model for Form


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `banner_image_url` | object | ❌ No | Banner Image URL |
| `columns` | `array` [] | ❌ No | Form Columns |
| `email` | object | ❌ No | Email to sned after form is submitted |
| `fk_model_id` | `string` | ❌ No | Foreign Key to Model |
| `source_id` | `string` | ❌ No | Source ID |
| `heading` | `string` | ❌ No | The heading of the form |
| `lock_type` | `string` | ❌ No | Lock Type of this view |
| `logo_url` | object | ❌ No | Logo URL |
| `meta` | object | ❌ No | Meta Info for this view |
| `redirect_after_secs` | object | ❌ No | The numbers of seconds to redirect after form submission |
| `redirect_url` | object | ❌ No | URL to redirect after submission |
| `show_blank_form` | object | ❌ No | Show &#x60;Blank Form&#x60; after 5 seconds |
| `subheading` | object | ❌ No | The subheading of the form |
| `submit_another_form` | object | ❌ No | Show &#x60;Submit Another Form&#x60; button |
| `success_msg` | object | ❌ No | Custom message after the form is successfully submitted |
| `title` | `string` | ❌ No | Form View Title |
| `starts_at` | object | ❌ No | Form start date. Before this date, the form shows a countdown and does not accept submissions. |
| `expires_at` | object | ❌ No | Form expiration date. After this date, the form will no longer accept submissions. |




---
## `FormUpdateReq`

> Model for Form Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `banner_image_url` | object | ❌ No | Banner Image URL |
| `email` | object | ❌ No | Email to sned after form is submitted |
| `heading` | `string` | ❌ No | The heading of the form |
| `logo_url` | object | ❌ No | Logo URL |
| `meta` | object | ❌ No | Meta Info for this view |
| `redirect_after_secs` | object | ❌ No | The numbers of seconds to redirect after form submission |
| `redirect_url` | object | ❌ No | URL to redirect after submission |
| `show_blank_form` | object | ❌ No | Show &#x60;Blank Form&#x60; after 5 seconds |
| `subheading` | object | ❌ No | The subheading of the form |
| `submit_another_form` | object | ❌ No | Show &#x60;Submit Another Form&#x60; button |
| `success_msg` | object | ❌ No | Custom message after the form is successfully submitted |
| `starts_at` | object | ❌ No | Form start date. Before this date, the form shows a countdown and does not accept submissions. |
| `expires_at` | object | ❌ No | Form expiration date. After this date, the form will no longer accept submissions. |




---
## `FormColumn`

> Model for Form Column


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `description` | object | ❌ No | Form Column Description |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_view_id` | object | ❌ No | Foreign Key to View |
| `help` | object | ❌ No | Form Column Help Text (Not in use) |
| `label` | object | ❌ No | Form Column Label |
| `meta` | object | ❌ No | Meta Info |
| `order` | `number` | ❌ No | The order among all the columns in the form |
| `required` | object | ❌ No | Is this form column required in submission? |
| `show` | object | ❌ No | Is this column shown in Form? |
| `enable_scanner` | object | ❌ No | Indicates whether the &#x27;Fill by scan&#x27; button is visible for this column or not. |
| `uuid` | object | ❌ No | Form Column UUID (Not in use) |




---
## `FormColumnReq`

> Model for Form Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `description` | object | ❌ No | Form Column Description |
| `help` | object | ❌ No | Form Column Help Text (Not in use) |
| `label` | object | ❌ No | Form Column Label |
| `meta` | object | ❌ No | Meta Info |
| `order` | `number` | ❌ No | The order among all the columns in the form |
| `required` | object | ❌ No | Is this form column required in submission? |
| `show` | object | ❌ No | Is this column shown in Form? |




---
## `Formula`

> Model for Formula


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `error` | `string` | ❌ No | Error Message |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `formula` | `string` | ❌ No | Formula with column ID replaced |
| `formula_raw` | `string` | ❌ No | Original Formula inputted in UI |
| `id` | object | ❌ No | Unique ID |
| `parsed_tree` | object | ❌ No | Parsed Formula Tree |




---
## `Button`

> Model for Button


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `type` | object | ❌ No | Whether button is webhook or url |
| `label` | `string` | ❌ No | Label of Button |
| `theme` | object | ❌ No | Button Theme |
| `color` | object | ❌ No | Button color |
| `icon` | `string` | ❌ No | Button Icon |
| `formula` | `string` | ❌ No | Formula with column ID replaced |
| `formula_raw` | `string` | ❌ No | Original Formula inputted in UI |
| `error` | `string` | ❌ No | Error Message |
| `parsed_tree` | `object` | ❌ No | Parsed Formula Tree |
| `fk_webhook_id` | object | ❌ No | Webhook ID |
| `fk_script_id` | object | ❌ No | Script ID |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `output_column_ids` | `string` | ❌ No | Comma separated column ids to be updated with the generated value |
| `fk_integration_id` | `string` | ❌ No | Foreign key to AI integration |
| `model` | `string` | ❌ No | AI model |
| `filters` | `array` [] | ❌ No | Visibility condition filters for the button |




---
## `ButtonColumnReq`

> Model for Button Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ❌ No | Formula Title |
| `uidt` | `string` | ❌ No | UI Data Type |
| `type` | object | ❌ No | Whether button is webhook or url |
| `theme` | object | ❌ No | Button Theme |
| `color` | object | ❌ No | Button color |
| `label` | `string` | ❌ No | Label of Button |
| `icon` | `string` | ❌ No | Button Icon |
| `fk_webhook_id` | object | ❌ No | Webhook ID |
| `formula` | `string` | ❌ No | Formula with column ID replaced |
| `formula_raw` | `string` | ❌ No | Original Formula inputted in UI |




---
## `FormulaColumnReq`

> Model for Formula Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `formula` | `string` | ❌ No | Formula with column ID replaced |
| `formula_raw` | `string` | ❌ No | Original Formula inputted in UI |
| `title` | `string` | ❌ No | Formula Title |
| `uidt` | `string` | ❌ No | UI Data Type |




---
## `Gallery`

> Model for Gallery


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `alias` | `string` | ❌ No | - |
| `columns` | `array` [] | ❌ No | - |
| `cover_image` | `string` | ❌ No | - |
| `cover_image_idx` | `integer` | ❌ No | - |
| `deleted` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `fk_cover_image_col_id` | object | ❌ No | Foreign Key to Cover Image Column |
| `fk_model_id` | `string` | ❌ No | Foreign Key to Model |
| `fk_view_id` | `string` | ❌ No | Foreign Key to View |
| `lock_type` | `string` | ❌ No | - |
| `next_enabled` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `order` | `number` | ❌ No | Order of Gallery |
| `prev_enabled` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `restrict_number` | `string` | ❌ No | - |
| `restrict_size` | `string` | ❌ No | - |
| `restrict_types` | `string` | ❌ No | - |
| `title` | `string` | ❌ No | - |




---
## `GalleryColumn`

> Model for Gallery Column


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_col_id` | `string` | ❌ No | - |
| `fk_gallery_id` | `string` | ❌ No | - |
| `help` | `string` | ❌ No | - |
| `id` | object | ❌ No | Unique ID |
| `label` | `string` | ❌ No | - |




---
## `GalleryUpdateReq`

> Model for Gallery View Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_cover_image_col_id` | object | ❌ No | The id of the column that contains the cover image |
| `meta` | object | ❌ No | Meta Info |




---
## `GeoLocation`

> Model for Geo Location


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `latitude` | `number` (double) | ❌ No | The latitude of the location |
| `longitude` | `number` (double) | ❌ No | The longitude of the location |




---
## `Grid`

> Model for Grid


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `base_id` | object | ❌ No | Base ID |
| `source_id` | object | ❌ No | Source ID |
| `fk_view_id` | object | ❌ No | Foreign Key to View |
| `row_height` | `number` | ❌ No | Row Height |
| `meta` | object | ❌ No | Meta info for Grid Model |
| `columns` | `array` [] | ❌ No | Grid View Columns |




---
## `Grid - copy`

> Model for Grid


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `base_id` | object | ❌ No | Base ID |
| `source_id` | object | ❌ No | Source ID |
| `fk_view_id` | object | ❌ No | Foreign Key to View |
| `row_height` | `number` | ❌ No | Row Height |
| `meta` | object | ❌ No | Meta info for Grid Model |
| `columns` | `array` [] | ❌ No | Grid View Columns |




---
## `GridColumn`

> Model for Grid Column


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `fk_view_id` | object | ❌ No | Foreign Key to View |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `base_id` | object | ❌ No | Base ID |
| `source_id` | object | ❌ No | Source ID |
| `show` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `order` | `number` | ❌ No | Grid Column Order |
| `width` | `string` | ❌ No | Column Width |
| `help` | object | ❌ No | Column Help Text |
| `group_by` | object | ❌ No | Group By |
| `group_by_order` | `number` | ❌ No | Group By Order |
| `group_by_sort` | object | ❌ No | Group By Sort |
| `aggregation` | object | ❌ No | Aggregation Type |




---
## `GridColumnReq`

> Model for Grid Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `help` | `string` | ❌ No | - |
| `label` | `string` | ❌ No | The label of the column |
| `width` | `string` | ❌ No | The width of the column |
| `group_by` | object | ❌ No | Group By |
| `group_by_order` | `number` | ❌ No | Group By Order |
| `group_by_sort` | object | ❌ No | Group By Sort |
| `aggregation` | object | ❌ No | Aggregation |




---
## `GridUpdateReq`

> Model for Grid View Update


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `row_height` | `number` | ❌ No | Row Height |
| `meta` | object | ❌ No | Meta Info for grid view |




---
## `Hook`

> Model for Hook


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `active` | object | ❌ No | Is the hook active? |
| `async` | object | ❌ No | Is the hook aysnc? |
| `description` | `string` | ❌ No | Hook Description |
| `env` | `string` | ❌ No | Environment for the hook |
| `event` | `string` | ❌ No | Event Type for the operation |
| `fk_model_id` | `string` | ❌ No | Foreign Key to Model |
| `id` | object | ❌ No | Unique ID |
| `notification` | `object,string` | ❌ No | Hook Notification including info such as type, payload, method, body, and etc |
| `operation` | `array` [string] | ❌ No | Hook Operation |
| `retries` | `number` | ❌ No | Retry Count |
| `retry_interval` | `number` | ❌ No | Retry Interval |
| `timeout` | `number` | ❌ No | Timeout |
| `title` | `string` | ❌ No | Hook Title |
| `type` | `string` | ❌ No | Hook Type |
| `version` | `string` | ❌ No | Hook Version |
| `trigger_field` | `boolean` | ❌ No | Is this hook only trigger when some fields are affected |
| `trigger_fields` | `array` [string] | ❌ No | - |




---
## `HookReq`

> Model for Hook


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `active` | object | ❌ No | Is the hook active? |
| `async` | object | ❌ No | Is the hook aysnc? |
| `description` | object | ❌ No | Hook Description |
| `env` | `string` | ❌ No | Environment for the hook |
| `event` | `string` | ✅ Yes | Event Type for the operation |
| `fk_model_id` | `string` | ❌ No | Foreign Key to Model |
| `id` | object | ❌ No | Unique ID |
| `notification` | `object,string` | ✅ Yes | Hook Notification including info such as type, payload, method, body, and etc |
| `operation` | `array` [string] | ✅ Yes | Hook Operation |
| `retries` | `number` | ❌ No | Retry Count |
| `retry_interval` | `number` | ❌ No | Retry Interval |
| `timeout` | `number` | ❌ No | Timeout |
| `title` | `string` | ✅ Yes | Hook Title |
| `type` | `string,null` | ❌ No | Hook Type |
| `condition` | object | ❌ No | Is this hook assoicated with some filters |
| `trigger_field` | `boolean` | ❌ No | Is this hook only trigger when some fields are affected |
| `trigger_fields` | `array` [string] | ❌ No | - |


**Required fields:** `event`, `notification`, `operation`, `title`



---
## `HookList`

> Model for Hook List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of hook objects |
| `pageInfo` | object | ✅ Yes | [Circular ref: #/components/schemas/Paginated] |


**Required fields:** `list`, `pageInfo`



---
## `HookLog`

> Model for Hook Log


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | `string` | ❌ No | Unique Source ID |
| `conditions` | `string` | ❌ No | Hook Conditions |
| `error` | object | ❌ No | Error |
| `error_code` | object | ❌ No | Error Code |
| `error_message` | object | ❌ No | Error Message |
| `event` | `string` | ❌ No | Hook Event |
| `execution_time` | `string` | ❌ No | Execution Time in milliseconds |
| `fk_hook_id` | object | ❌ No | Foreign Key to Hook |
| `id` | object | ❌ No | Unique ID |
| `notifications` | `string` | ❌ No | Hook Notification |
| `operation` | `string` | ❌ No | Hook Operation |
| `payload` | `string` | ❌ No | Hook Payload |
| `base_id` | `string` | ❌ No | Base ID |
| `response` | object | ❌ No | Hook Response |
| `test_call` | object | ❌ No | Is this testing hook call? |
| `triggered_by` | object | ❌ No | Who triggered the hook? |
| `type` | `string` | ❌ No | Hook Type |




---
## `HookLogList`

> Model for Hook Log List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of hook objects |
| `pageInfo` | object | ✅ Yes | [Circular ref: #/components/schemas/Paginated] |


**Required fields:** `list`, `pageInfo`



---
## `HookTestReq`

> Model for Hook Test Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `hook` | object | ✅ Yes | [Circular ref: #/components/schemas/HookReq] |
| `payload` | object | ✅ Yes | Payload to be sent |


**Required fields:** `hook`, `payload`



---
## `Id`

> Model for ID


**Type:** `string`





---
## `Kanban`

> Model for Kanban


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `fk_grp_col_id` | object | ❌ No | Grouping Field Column ID |
| `fk_view_id` | object | ❌ No | View ID |
| `fk_cover_image_col_id` | object | ❌ No | Cover Image Column ID |
| `columns` | `array` [] | ❌ No | Kanban Columns |
| `meta` | object | ❌ No | Meta Info for Kanban |
| `title` | `string` | ❌ No | Kanban Title |




---
## `KanbanColumn`

> Model for Kanban Column


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_view_id` | object | ❌ No | Foreign Key to View |
| `source_id` | object | ❌ No | Baes ID
 |
| `base_id` | object | ❌ No | Base ID |
| `title` | `string` | ❌ No | Base ID |
| `show` | object | ❌ No | Is this column shown? |
| `order` | `number` | ❌ No | Column Order |




---
## `KanbanUpdateReq`

> Model for Kanban Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_grp_col_id` | object | ❌ No | Foreign Key to Grouping Field Column |
| `fk_cover_image_col_id` | object | ❌ No | Foreign Key to Cover Image Column |
| `meta` | object | ❌ No | Meta Info |




---
## `MCPToken`

> Model for MCP Token


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ No | Unique ID |
| `title` | `string` | ❌ No | Title of the MCP Token |
| `order` | `number` | ❌ No | Order of the Script |
| `token` | `string` | ❌ No | MCP Token |
| `fk_workspace_id` | object | ❌ No | Workspace ID |
| `base_id` | object | ❌ No | Base ID |
| `fk_user_id` | object | ❌ No | User ID of the creator |
| `updated_at` | `string` | ❌ No | Last updated time |
| `created_at` | `string` | ❌ No | Creation time |




---
## `Calendar`

> Model for Calendar


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `fk_view_id` | object | ❌ No | View ID |
| `fk_cover_image_col_id` | object | ❌ No | Cover Image Column ID |
| `columns` | `array` [] | ❌ No | Calendar Columns |
| `calendar_range` | `array` [] | ❌ No | Calendar Date Range |
| `meta` | object | ❌ No | Meta Info for Kanban |
| `title` | `string` | ❌ No | Kanban Title |




---
## `CalendarColumn`

> Model for Calendar Column


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_view_id` | object | ❌ No | Foreign Key to View |
| `source_id` | object | ❌ No | Baes ID
 |
| `base_id` | object | ❌ No | Base ID |
| `title` | `string` | ❌ No | Base ID |
| `show` | object | ❌ No | Is this column shown? |
| `bold` | object | ❌ No | Is this column shown as bold? |
| `italic` | object | ❌ No | Is this column shown as italic? |
| `underline` | object | ❌ No | Is this column shown underlines? |
| `order` | `number` | ❌ No | Column Order |




---
## `DateDependency`

> Model for Date Dependency


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique identifier |
| `fk_model_id` | object | ❌ No | Foreign Key to Model (Table) |
| `fk_start_date_field_id` | object | ❌ No | Foreign Key to start date Column |
| `fk_end_date_field_id` | object | ❌ No | Foreign Key to end date Column |
| `fk_duration_field_id` | object | ❌ No | Foreign Key to duration Column |
| `fk_dependency_linkrow_field_id` | object | ❌ No | Foreign Key to link-row Column used for predecessor/successor dependency |
| `dependency_linkrow_role` | `string` | ❌ No | Whether the linkrow field links to predecessors or successors |
| `dependency_connection_type` | `string` | ❌ No | Which date from predecessor drives which date in successor |
| `dependency_buffer_type` | `string` | ❌ No | Type of buffer between predecessor end and successor start |
| `dependency_buffer_days` | `integer` | ❌ No | Buffer in days between predecessor and successor |
| `include_weekends` | `boolean` | ❌ No | Whether to include weekends in date calculations |
| `is_active` | `boolean` | ❌ No | Whether the date dependency rule is active |




---
## `DateDependencyReq`

> Request model for creating/updating Date Dependency


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_start_date_field_id` | object | ❌ No | Foreign Key to start date Column |
| `fk_end_date_field_id` | object | ❌ No | Foreign Key to end date Column |
| `fk_duration_field_id` | object | ❌ No | Foreign Key to duration Column |
| `fk_dependency_linkrow_field_id` | object | ❌ No | Foreign Key to link-row Column |
| `dependency_linkrow_role` | `string` | ❌ No | - |
| `dependency_connection_type` | `string` | ❌ No | - |
| `dependency_buffer_type` | `string` | ❌ No | - |
| `dependency_buffer_days` | `integer` | ❌ No | - |
| `include_weekends` | `boolean` | ❌ No | - |
| `is_active` | `boolean` | ❌ No | - |




---
## `CalendarRange`

> Model for Calendar Date Range


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_from_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_view_id` | object | ❌ No | Foreign Key to View |
| `label` | `string` | ❌ No | Base ID |




---
## `CalendarUpdateReq`

> Model for Calendar Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_cover_image_col_id` | object | ❌ No | Foreign Key to Cover Image Column |
| `title` | `string` | ❌ No | Calendar Title |
| `calendar_range` | `array` [] | ❌ No | Calendar Columns |
| `meta` | object | ❌ No | Meta Info |




---
## `LicenseReq`

> Model for Kanban Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ❌ No | The license key |




---
## `LinkToAnotherColumnReq`

> Model for LinkToAnotherColumn Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `childViewId` | object | ❌ No | Foreign Key to child view |
| `childId` | object | ✅ Yes | Foreign Key to chhild column |
| `parentId` | object | ✅ Yes | Foreign Key to parent column |
| `title` | `string` | ✅ Yes | The title of the virtual column |
| `type` | `string` | ✅ Yes | The type of the relationship |
| `uidt` | `string` | ✅ Yes | Abstract type of the relationship |
| `virtual` | object | ❌ No | Is this relationship virtual? |


**Required fields:** `childId`, `parentId`, `title`, `type`, `uidt`



---
## `LinkToAnotherRecord`

> Model for LinkToAnotherRecord


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `deleted` | `string` | ❌ No | - |
| `dr` | `string` | ❌ No | - |
| `fk_child_column_id` | `string` | ❌ No | - |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_index_name` | `string` | ❌ No | - |
| `fk_relation_view_id` | `string` | ❌ No | - |
| `fk_mm_child_column_id` | `string` | ❌ No | - |
| `fk_mm_model_id` | `string` | ❌ No | - |
| `fk_mm_parent_column_id` | `string` | ❌ No | - |
| `fk_parent_column_id` | `string` | ❌ No | - |
| `fk_related_model_id` | `string` | ❌ No | - |
| `id` | object | ❌ No | Unique ID |
| `order` | `string` | ❌ No | - |
| `type` | `string` | ❌ No | - |
| `ur` | `string` | ❌ No | - |
| `virtual` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `fk_related_base_id` | `string` | ❌ No | - |
| `fk_mm_base_id` | `string` | ❌ No | - |
| `base_id` | `string` | ❌ No | - |
| `fk_related_source_id` | `string` | ❌ No | - |
| `fk_mm_source_id` | `string` | ❌ No | - |
| `version` | `number` | ❌ No | - |




---
## `Lookup`

> Model for Lookup


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_lookup_column_id` | object | ❌ No | Foreign Key to Lookup Column |
| `fk_relation_column_id` | object | ❌ No | Foreign Key to Relation Column |
| `order` | `number` | ❌ No | The order among the list |




---
## `LookupColumnReq`

> Model for Lookup Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_lookup_column_id` | object | ❌ No | Foreign Key to Lookup Column |
| `fk_relation_column_id` | object | ❌ No | Foreign Key to Relation Column |
| `title` | `string` | ❌ No | Lookup Title |
| `uidt` | `string` | ❌ No | UI DataType |




---
## `Map`

> Model for Map


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | `string` | ❌ No | The ID of the source that this view belongs to |
| `columns` | `array` [] | ❌ No | Columns in this view |
| `fk_geo_data_col_id` | `string` | ❌ No | Foreign Key to GeoData Column |
| `fk_view_id` | `string` | ❌ No | Unique ID for Map |
| `meta` | object | ❌ No | Meta data for this view |
| `order` | `number` | ❌ No | The order of the map list |
| `base_id` | `string` | ❌ No | The ID of the base that this view belongs to |
| `show` | `boolean` | ❌ No | To show this Map or not |
| `title` | `string` | ❌ No | Title of Map View |




---
## `MapUpdateReq`

> Model for Map


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_geo_data_col_id` | `string` | ❌ No | Foreign Key to GeoData Column |
| `meta` | object | ❌ No | Meta data for this view |




---
## `MapColumn`

> Model for Map Column


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | `string` | ❌ No | The ID of the source that this map column belongs to |
| `fk_column_id` | `string` | ❌ No | Foreign Key to Column |
| `fk_view_id` | `string` | ❌ No | Foreign Key to View |
| `id` | `string` | ❌ No | Unique ID of Map Column |
| `order` | `number` | ❌ No | the order in the list of map columns |
| `base_id` | `string` | ❌ No | The ID of the base that this map column belongs to |
| `show` | `number` | ❌ No | Whether to show this column or not |




---
## `Meta`

> Model for Meta






---
## `ModelRoleVisibility`

> Model for ModelRoleVisibility


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | `string` | ❌ No | - |
| `disabled` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `fk_model_id` | `string` | ❌ No | - |
| `fk_view_id` | `string` | ❌ No | - |
| `id` | object | ❌ No | Unique ID |
| `base_id` | `string` | ❌ No | - |
| `role` | `string` | ❌ No | - |




---
## `NormalColumnRequest`

> Model for Normal Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ai` | object | ❌ No | Is this column auto-incremented? |
| `au` | object | ❌ No | Is this column auto-updated datetime field? |
| `cc` | object | ❌ No | Column Comment |
| `cdf` | object | ❌ No | Column Default Value |
| `column_name` | `string` | ❌ No | Column Name |
| `csn` | object | ❌ No | [Circular ref: #/components/schemas/StringOrNull] |
| `dt` | `string` | ❌ No | Data Type |
| `dtx` | object | ❌ No | Data Type Extra |
| `dtxp` | object | ❌ No | Data Type Extra Precision |
| `dtxs` | object | ❌ No | Data Type Extra Scale |
| `np` | object | ❌ No | Numeric Precision |
| `ns` | object | ❌ No | Numeric Scale |
| `pk` | object | ❌ No | Is this column a primary key? |
| `pv` | object | ❌ No | Is this column a primary value? |
| `rqd` | object | ❌ No | Is this column required? |
| `title` | `string` | ✅ Yes | Column Title |
| `uidt` | `string` | ❌ No | UI Data Type |
| `un` | object | ❌ No | Is this column unique? |
| `unique` | object | ❌ No | Is this column unique? |
| `readonly` | object | ❌ No | Is this column readonly? |


**Required fields:** `title`



---
## `OrgUserReq`

> Model for Organisation User Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` (email) | ❌ No | - |
| `roles` | `string` | ❌ No | Roles for the base user |




---
## `Paginated`

> Model for Paginated


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `isFirstPage` | `boolean` | ❌ No | Is the current page the first page |
| `isLastPage` | `boolean` | ❌ No | Is the current page the last page |
| `page` | `number` | ❌ No | The current page |
| `offset` | `number` | ❌ No | The current offset and it will be present only when the page is not included |
| `pageSize` | `number` | ❌ No | The number of pages |
| `totalRows` | `number` | ❌ No | The number of rows in the given result |




---
## `PaginatedV3`

> Model for Paginated


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `next` | `string` | ❌ No | URL to access next page |
| `prev` | `string` | ❌ No | URL to access previous page |
| `nestedNext` | `string` | ❌ No | URL to access current page data with next set of nested fields data |
| `nestedPrev` | `string` | ❌ No | URL to access current page data with previous set of nested fields data |




---
## `Password`

> Model for Password


**Type:** `string`




### Example

```json
"password123456789"
```


---
## `PasswordChangeReq`

> Model for Password Change Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `currentPassword` | `string` | ✅ Yes | - |
| `newPassword` | `string` | ✅ Yes | - |


**Required fields:** `currentPassword`, `newPassword`



---
## `PasswordForgotReq`

> Model for Password Forgot Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` (email) | ✅ Yes | Email address of the user |


**Required fields:** `email`



---
## `PasswordResetReq`

> Model for Password Reset Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `password` | `string` | ✅ Yes | New password |


**Required fields:** `password`



---
## `Plugin`

> Model for Plugin


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `active` | object | ❌ No | Is plguin active? |
| `category` | `string` | ❌ No | Plugin Category |
| `creator` | `string` | ❌ No | Plugin Creator (Not in use) |
| `creator_website` | `string` | ❌ No | Plugin Creator website (Not in use) |
| `description` | `string` | ❌ No | Plugin Description |
| `docs` | `string` | ❌ No | Documentation of plugin (Not in use) |
| `icon` | `string` | ❌ No | Plugin Icon - IconMapKey. Takes priority over &#x27;logo&#x27; if both are provided. |
| `id` | object | ❌ No | Unique ID |
| `input` | object | ❌ No | Plugin Input |
| `input_schema` | `string` | ❌ No | Plugin Input Schema
 |
| `logo` | `string` | ❌ No | Plugin logo |
| `price` | `string` | ❌ No | Plugin Price (Not in use) |
| `rating` | `number` | ❌ No | Plugin Rating (Not in use) |
| `status` | `string` | ❌ No | Plugin Status |
| `status_details` | `string` | ❌ No | Not in use |
| `tags` | `string` | ❌ No | Plugin tags |
| `title` | `string` | ❌ No | Plugin Title |
| `version` | `string` | ❌ No | Plugin Version |




---
## `PluginReq`

> Model for Plugin Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `active` | object | ❌ No | Is Plugin Active? |
| `input` | object | ❌ No | Plugin Input |




---
## `PluginTestReq`

> Model for Plugin Test Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ✅ Yes | Plugin Title |
| `input` | object | ✅ Yes | - |
| `category` | `string` | ✅ Yes | - |


**Required fields:** `title`, `input`, `category`



---
## `Base`

> Model for Base


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sources` | `array` [object] | ❌ No | List of source models |
| `color` | `string` | ❌ No | Primary Theme Color |
| `deleted` | object | ❌ No | Model for Bool |
| `description` | `string` | ❌ No | Base Description |
| `id` | `string` | ❌ No | Unique Base ID |
| `fk_workspace_id` | `string` | ❌ No | Workspace ID |
| `is_meta` | object | ❌ No | Model for Bool |
| `meta` | object | ❌ No | Meta Info such as theme colors |
| `order` | `number` | ❌ No | The order in base list |
| `prefix` | `string` | ❌ No | Base prefix. Used in XCDB only. |
| `type` | `string` | ❌ No | - |
| `linked_db_projects` | `array` [] | ❌ No | List of linked Database Projects that this base has access to (only used in Dashboard bases so far) |
| `status` | `string` | ❌ No | - |
| `title` | `string` | ❌ No | Base Title |
| `fk_custom_url_id` | object | ❌ No | ID of custom url |
| `permissions` | `array` [object] | ❌ No | List of permissions for the base |
| `is_sandbox` | object | ❌ No | Model for Bool |
| `is_sandbox_master` | object | ❌ No | Model for Bool |




---
## `ProjectList`

> Model for Base List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of Base Models |
| `pageInfo` | `object` | ✅ Yes | Model for Paginated |


**Required fields:** `list`, `pageInfo`



---
## `ProjectReq`

> Model for Base Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sources` | `array` [object] | ❌ No | Array of Bases |
| `color` | `string` | ❌ No | Primary Theme Color |
| `description` | `string` | ❌ No | Base Description |
| `title` | `string` | ✅ Yes | Base Title |
| `status` | object | ❌ No | Base Status |
| `type` | `string` | ❌ No | - |
| `meta` | object | ❌ No | Base Meta |
| `fk_workspace_id` | `string` | ❌ No | Workspace ID |


**Required fields:** `title`



---
## `ProjectUpdateReq`

> Model for Base Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `color` | `string` | ❌ No | Primary Theme Color |
| `meta` | object | ❌ No | Base Meta |
| `title` | `string` | ❌ No | Base Title |
| `status` | object | ❌ No | Base Status |
| `order` | `number` | ❌ No | The order of the list of projects. |




---
## `ProjectUserReq`

> Model for Base User Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` | ✅ Yes | Base User Email |
| `roles` | `string` | ✅ Yes | Base User Role |


**Required fields:** `email`, `roles`



---
## `ProjectUserUpdateReq`

> Model for Base User Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` (email) | ❌ No | Base User Email |
| `roles` | `string` | ✅ Yes | Base User Role |


**Required fields:** `roles`



---
## `ProjectUserMetaReq`

> Model for Base User Meta Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `starred` | object | ❌ No | Model for Bool |
| `order` | `number` | ❌ No | The order among the bases |
| `hidden` | object | ❌ No | Model for Bool |




---
## `Rollup`

> Model for Rollup


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `fk_relation_column_id` | object | ❌ No | Foreign to Relation Column |
| `fk_rollup_column_id` | object | ❌ No | Foreign to Rollup Column |
| `rollup_function` | `string` | ❌ No | Rollup Function |




---
## `RollupColumnReq`

> Model for Rollup Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_relation_column_id` | object | ❌ No | Foreign Key to Relation Column |
| `fk_rollup_column_id` | object | ❌ No | Foreign Key to Rollup Column |
| `title` | `string` | ❌ No | Rollup Column Title |
| `rollup_function` | `string` | ❌ No | Rollup Function |
| `uidt` | `string` | ❌ No | UI DataType |




---
## `SelectOption`

> Model for SelectOption


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `title` | `string` | ❌ No | Option Title
 |
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `color` | `string` | ❌ No | Option Color |
| `order` | `number` | ❌ No | The order among the options |




---
## `SelectOptions`

> Model for SelectOptions


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `array` [] | ✅ Yes | Array of select options |


**Required fields:** `options`



---
## `SharedBaseReq`

> Model for Shared Base Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `roles` | `string` | ❌ No | The role given the target user |




---
## `SharedView`

> Model for Shared View






---
## `SharedViewList`

> Model for Shared View List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of shared view objects |
| `pageInfo` | object | ✅ Yes | Paginated Info |


**Required fields:** `list`, `pageInfo`



---
## `SharedViewReq`

> Model for Shared View Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `meta` | object | ❌ No | Meta data passing to Shared View such as if download is allowed or not. |
| `password` | object | ❌ No | Password to restrict access |




---
## `SignInReq`

> Model for Signin Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` (email) | ✅ Yes | Email address of the user |
| `password` | `string` | ✅ Yes | Password of the user |


**Required fields:** `email`, `password`



---
## `SignUpReq`

> Model for Signup Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` (email) | ✅ Yes | Email address of the user |
| `password` | `string` | ✅ Yes | Password of the user |
| `firstname` | object | ❌ No | Model for StringOrNull |
| `lastname` | object | ❌ No | Model for StringOrNull |
| `token` | object | ❌ No | Sign Up Token. Used for invitation. |
| `ignore_subscribe` | object | ❌ No | Ignore Subscription |


**Required fields:** `email`, `password`



---
## `Sort`

> Model for Sort


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `fk_column_id` | object | ❌ No | [Circular ref: #/components/schemas/Id] |
| `fk_model_id` | object | ❌ No | [Circular ref: #/components/schemas/Id] |
| `source_id` | `string` | ❌ No | Source ID |
| `direction` | `string` | ❌ No | Sort direction |
| `order` | `number` | ❌ No | - |
| `base_id` | `string` | ❌ No | Base ID |
| `fk_level_id` | object | ❌ No | Foreign Key to List View Level |




---
## `SortList`

> Model for Sort List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of Sort Objects |
| `pageInfo` | object | ✅ Yes | [Circular ref: #/components/schemas/Paginated] |


**Required fields:** `list`, `pageInfo`



---
## `SortReq`

> Model for Sort Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `direction` | `string` | ❌ No | Sort direction |
| `fk_level_id` | object | ❌ No | Foreign Key to List View Level |




---
## `TextOrNull`

> Model for TextOrNull






---
## `CalendarRangeOrNull`

> Model for CalendarRangeOrNull





### Example

```json
[
  {
    "id": "kvc_2skkg5mi1eb37f",
    "fk_from_column_id": "cl_hzos4ghyncqi4k",
    "fk_to_column_id": "cl_hzos4ghyncqi4k",
    "fk_view_id": "vw_wqs4zheuo5lgdy",
    "label": "string"
  }
]
```


---
## `StringOrNull`

> Model for StringOrNull






---
## `StringOrNullOrBooleanOrNumber`

> Model for StringOrNullOrBooleanOrNumber






---
## `IdOrNull`

> Model for IdOrNull






---
## `Table`

> Model for Table


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | `string` | ❌ No | Unique Source ID |
| `date_dependency` | object | ❌ No | Date dependency rule for this table |
| `columns` | `array` [] | ❌ No | The columns included in this table |
| `columnsById` | `object` | ❌ No | Column Models grouped by IDs |
| `columnsHash` | `string` | ❌ No | Hash of columns |
| `deleted` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `enabled` | object | ❌ No | Is this table enabled? |
| `id` | `string` | ❌ No | Unique Table ID |
| `meta` | object | ❌ No | Meta Data |
| `mm` | object | ❌ No | Is this table used for M2M |
| `order` | `number` | ❌ No | The order of the list of tables |
| `pinned` | object | ❌ No | Currently not in use |
| `base_id` | `string` | ❌ No | Unique Base ID |
| `description` | object | ❌ No | Table Description |
| `table_name` | `string` | ❌ No | Table Name. Prefix will be added for XCDB bases. |
| `tags` | object | ❌ No | Currently not in use |
| `title` | `string` | ✅ Yes | Table Title |
| `type` | `string` | ❌ No | Table Type |
| `synced` | object | ❌ No | Is this table synced? |


**Required fields:** `title`, `title`



---
## `TableList`

> Model for Table List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of table objects |
| `pageInfo` | object | ✅ Yes | Paginated Info |


**Required fields:** `list`, `pageInfo`



---
## `TableReq`

> Model for Table Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `array` [] | ✅ Yes | The column models in this table |
| `description` | object | ❌ No | Table description |
| `meta` | object | ❌ No | the meta data for this table |
| `order` | `number` | ❌ No | The order of table list |
| `table_name` | `string` | ❌ No | Table name |
| `title` | `string` | ✅ Yes | Table title |


**Required fields:** `columns`, `title`



---
## `User`

> Model for User


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✅ Yes | Unique identifier for the given user. |
| `email` | `string` (email) | ✅ Yes | - |
| `roles` | `string` | ❌ No | - |
| `email_verified` | `boolean` | ✅ Yes | Set to true if the user&#x27;s email has been verified. |
| `created_at` | `string` (date) | ❌ No | The date that the user was created. |
| `updated_at` | `string` (date) | ❌ No | The date that the user was created. |
| `display_name` | `string` | ❌ No | - |
| `user_name` | `string` | ❌ No | - |
| `bio` | `string` | ❌ No | - |
| `location` | `string` | ❌ No | - |
| `website` | `string` | ❌ No | - |
| `avatar` | `string` | ❌ No | - |
| `is_new_user` | `boolean` | ❌ No | - |
| `token_version` | `string` | ❌ No | Access token version |
| `meta` | object | ❌ No | Meta data for user |


**Required fields:** `id`, `email`, `email_verified`



---
## `UserInfo`

> Model for User Info


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` (email) | ❌ No | User Email |
| `email_verified` | `boolean` | ❌ No | Set to true if the user&#x27;s email has been verified. |
| `firstname` | `string` | ❌ No | The firstname of the user |
| `id` | `string` | ❌ No | User ID |
| `lastname` | `string` | ❌ No | The lastname of the user |
| `roles` | object | ❌ No | The roles of the user |
| `base_roles` | object | ❌ No | The base roles of the user |
| `workspace_roles` | object | ❌ No | The workspace roles of the user |




---
## `UserList`

> Model for User List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [object] | ✅ Yes | List of user objects |
| `pageInfo` | `object` | ✅ Yes | Paginated Info |


**Required fields:** `list`, `pageInfo`



---
## `View`

> Model for View


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | object | ❌ No | Unique Source ID |
| `fk_model_id` | object | ✅ Yes | Unique Model ID |
| `id` | object | ❌ No | Unique ID for View |
| `lock_type` | `string` | ❌ No | Lock Type of the view |
| `meta` | object | ❌ No | Meta data for this view |
| `order` | `number` | ❌ No | The rder of the list of views |
| `description` | object | ❌ No | View Description |
| `password` | object | ❌ No | Password for protecting the view |
| `base_id` | object | ❌ No | Unique Base ID |
| `show` | object | ✅ Yes | If this view is shown? |
| `show_system_fields` | object | ❌ No | Should show system fields in this view? |
| `title` | `string` | ✅ Yes | View Title |
| `type` | `number` | ✅ Yes | View Type |
| `uuid` | object | ❌ No | UUID of the view |
| `view` | object | ❌ No | Associated View Model |
| `owned_by` | object | ❌ No | ID of view owner user |
| `row_coloring_mode` | `string` | ❌ No | The row coloring mode whether it is select, condition or not set |
| `fk_custom_url_id` | object | ❌ No | ID of custom url |


**Required fields:** `fk_model_id`, `show`, `title`, `type`



---
## `ViewList`

> Model for View List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of view objects |
| `pageInfo` | object | ✅ Yes | Paginated Info |


**Required fields:** `list`, `pageInfo`



---
## `ViewCreateReq`

> Model for View Create Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ✅ Yes | View Title |
| `type` | `number` | ❌ No | View Type |
| `copy_from_id` | object | ❌ No | ID of view to be copied from. Used in Copy View. |
| `fk_grp_col_id` | object | ❌ No | Foreign Key to Grouping Column. Used in creating Kanban View. |
| `fk_geo_data_col_id` | object | ❌ No | Foreign Key to Geo Data Column. Used in creating Map View. |
| `calendar_range` | object | ❌ No | Calendar Range or Null |
| `description` | object | ❌ No | Description of the view. |


**Required fields:** `title`



---
## `ViewUpdateReq`

> Model for View Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ❌ No | View Title |
| `description` | object | ❌ No | Description of the view. |
| `uuid` | `string` | ❌ No | View UUID. Used in Shared View. |
| `password` | `string` | ❌ No | View Password. Used in Shared View. |
| `lock_type` | `string` | ❌ No | Lock type of View. |
| `meta` | object | ❌ No | Meta info used in View. |
| `order` | `number` | ❌ No | The order of the list of views. |
| `show_system_fields` | object | ❌ No | Should this view show system fields? |
| `owned_by` | object | ❌ No | ID of view owner user |




---
## `ViewColumnUpdateReq`

> Model for View Column Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `show` | object | ❌ No | View Title |
| `order` | `number` | ❌ No | The order of the list of views. |




---
## `ViewColumnReq`

> Model for View Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_column_id` | object | ❌ No | Foreign Key to Column |
| `show` | object | ❌ No | View Title |
| `order` | `number` | ❌ No | The order of the list of views. |




---
## `VisibilityRuleReq`

> Model for Visibility Rule Request


**Type:** `array`





---
## `Webhook`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ No | - |
| `title` | `string` | ❌ No | - |
| `type` | `string` | ❌ No | - |




---
## `ProjectInviteEvent`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_user_id` | `string` | ✅ Yes | The ID of the user who receives the base invite |
| `type` | `string` | ✅ Yes | The type of event, which should be set to &#x27;PROJECT_INVITE&#x27; |
| `body` | `object` | ✅ Yes | - |


**Required fields:** `fk_user_id`, `type`, `body`



---
## `WelcomeEvent`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fk_user_id` | `string` | ✅ Yes | The ID of the user receiving the welcome message |
| `type` | `string` | ✅ Yes | The type of event, which should be set to &#x27;WELCOME&#x27; |
| `body` | `object` | ✅ Yes | An empty object |


**Required fields:** `fk_user_id`, `type`, `body`



---
## `Notification`






---
## `NotificationList`

> Model for Notification List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of notification objects |
| `pageInfo` | object | ✅ Yes | Model for Paginated |


**Required fields:** `list`, `pageInfo`



---
## `NotificationUpdate`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `is_read` | `boolean` | ❌ No | - |




---
## `UserFieldRecord`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ No | - |
| `display_name` | `string` | ❌ No | - |
| `email` | `string` | ❌ No | - |
| `deleted` | `boolean` | ❌ No | - |
| `meta` | object | ❌ No | Meta data for user |




---
## `nestedListCopyPasteOrDeleteAllReq`


**Type:** `array`





---
## `KanbanColumnReq`

> Model for Kanban Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ❌ No | Title |
| `show` | object | ❌ No | Is this column shown? |
| `order` | `number` | ❌ No | Column Order |




---
## `GalleryColumnReq`

> Model for Gallery Column Request



### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `show` | object | ❌ No | Show |
| `order` | `number` | ❌ No | Order |




---
## `CalendarColumnReq`

> Model for Calendar Column Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `show` | object | ❌ No | Is this column shown? |
| `bold` | object | ❌ No | Is this column shown as bold? |
| `italic` | object | ❌ No | Is this column shown as italic? |
| `underline` | object | ❌ No | Is this column shown underlines? |
| `order` | `number` | ❌ No | Column Order |




---
## `ErrorReportReq`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `errors` | `array` [object] | ❌ No | - |
| `extra` | `object` | ❌ No | - |




---
## `Comment`

> Model for Comment


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `row_id` | `string` | ❌ No | Row ID |
| `comment` | `string` | ❌ No | Comment |
| `created_by` | object | ❌ No | Created By User ID |
| `created_by_email` | `string` | ❌ No | Created By User Email |
| `resolved_by` | object | ❌ No | Resolved By User ID |
| `resolved_by_email` | `string` | ❌ No | Resolved By User Email |
| `parent_comment_id` | object | ❌ No | Parent Comment ID |
| `source_id` | object | ❌ No | Source ID |
| `base_id` | object | ❌ No | Base ID |
| `fk_model_id` | object | ❌ No | Model ID |
| `created_at` | `string` | ❌ No | Created At |
| `updated_at` | `string` | ❌ No | Updated At |
| `is_deleted` | `boolean` | ❌ No | Whether the comment has been deleted by the user or not |




---
## `UserCommentNotificationPreference`

> Model for User Comment Notification Preference


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `row_id` | `string` | ❌ No | User ID |
| `user_id` | object | ❌ No | User ID |
| `source_id` | object | ❌ No | Source ID |
| `base_id` | object | ❌ No | Base ID |
| `fk_model_id` | object | ❌ No | Model ID |
| `preference` | `string` | ❌ No | Is Read |
| `created_at` | `string` | ❌ No | Created At |
| `updated_at` | `string` | ❌ No | Updated At |




---
## `CommentReactions`

> Model for Comment Reactions


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `row_id` | `string` | ❌ No | Row ID |
| `comment_id` | object | ❌ No | Comment ID |
| `reaction` | `string` | ❌ No | Reaction |
| `user_id` | object | ❌ No | User ID |
| `source_id` | object | ❌ No | Source ID |
| `base_id` | object | ❌ No | Base ID |
| `fk_model_id` | object | ❌ No | Model ID |
| `created_at` | `string` | ❌ No | Created At |
| `updated_at` | `string` | ❌ No | Updated At |




---
## `Extension`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `base_id` | object | ❌ No | Unique Base ID |
| `fk_user_id` | object | ❌ No | Unique User ID |
| `extension_id` | `string` | ❌ No | Extension ID |
| `title` | `string` | ❌ No | Extension Title |
| `kv_store` | object | ❌ No | Key Value Store for the extension |
| `meta` | object | ❌ No | Meta data for the extension |
| `order` | `number` | ❌ No | Order of the extension |




---
## `Snapshot`

> Model for Snapshot


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | object | ❌ No | Unique ID |
| `title` | `string` | ❌ No | Title of the Snapshot |
| `base_id` | object | ❌ No | Foreign Key to Base |
| `snapshot_base_id` | object | ❌ No | Foreign Key to Snapshot Base |
| `fk_workspace_id` | object | ❌ No | Foreign Key to Workspace |
| `created_at` | `string` (date) | ❌ No | Date of creation |
| `created_by` | object | ❌ No | User ID of the creator |
| `status` | `string` | ❌ No | Status of the Snapshot |




---
## `Script`

> Model for Script


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ No | Unique ID |
| `title` | `string` | ❌ No | Title of the Script |
| `description` | `string` | ❌ No | Description of the Script |
| `meta` | `object` | ❌ No | Meta data for the Script |
| `config` | `object` | ❌ No | Config for the Script |
| `order` | `number` | ❌ No | Order of the Script |
| `base_id` | object | ❌ No | Base ID |
| `fk_workspace_id` | object | ❌ No | Workspace ID |
| `created_by` | object | ❌ No | User ID of the creator |
| `script` | `string` | ❌ No | Code of the script |
| `updated_at` | `string` | ❌ No | Last updated time |
| `created_at` | `string` | ❌ No | Creation time |




---
## `Workflow`

> Model for Workflow


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ No | Unique ID |
| `title` | `string` | ❌ No | Title of the Workflow |
| `description` | `string` | ❌ No | Description of the Workflow |
| `base_id` | object | ❌ No | Base ID |
| `fk_workspace_id` | object | ❌ No | Workspace ID |
| `enabled` | `boolean` | ❌ No | Whether the workflow is enabled |
| `nodes` | object | ❌ No | Nodes configuration for the workflow workflow |
| `edges` | object | ❌ No | Edges configuration for the workflow workflow |
| `meta` | object | ❌ No | Meta data for the Workflow |
| `draft` | `object` | ❌ No | Draft data for the Workflow |
| `order` | `number` | ❌ No | The order of the workflow in the list |
| `updated_at` | `string` | ❌ No | Last updated time |
| `created_at` | `string` | ❌ No | Creation time |
| `created_by` | object | ❌ No | User ID of the creator |
| `updated_by` | object | ❌ No | User ID of the last updated user |




---
## `ExtensionReq`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `base_id` | object | ❌ No | Unique Base ID |
| `title` | `string` | ❌ No | Extension Title |
| `extension_id` | `string` | ❌ No | Extension ID |
| `kv_store` | object | ❌ No | Key Value Store for the extension |
| `meta` | object | ❌ No | Meta data for the extension |
| `order` | `number` | ❌ No | Order of the extension |




---
## `AIRecord`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ❌ No | Value |
| `lastModifiedBy` | object | ❌ No | Last Modified By User ID |
| `lastModifiedTime` | `string` | ❌ No | Last Modified Time |
| `isStale` | `boolean` | ❌ No | Is any referenced value updated? |
| `isAiEdited` | `boolean` | ❌ No | Is edited by AI? |




---
## `ButtonActions`


**Type:** `string`





---
## `CustomUrl`

> Model for Custom Url


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ No | Id associated to the Custom url |
| `fk_workspace_id` | `string` | ❌ No | Workspace ID |
| `fk_dashboard_id` | `string` | ❌ No | Dashboard ID |
| `base_id` | `string` | ❌ No | Base ID |
| `fk_model_id` | `string` | ❌ No | Model ID |
| `view_id` | `string` | ❌ No | View ID |
| `original_path` | `string` | ❌ No | Original url used for redirection purpose |
| `custom_path` | `string` | ❌ No | Custom url path |




---
## `ListViewLevel`

> Model for List View Level


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ No | Unique ID for Level |
| `fk_view_id` | `string` | ❌ No | Foreign Key to View |
| `level` | `number` | ❌ No | Level number (1, 2, or 3) |
| `fk_model_id` | `string` | ❌ No | Foreign Key to Model (table) for this level |
| `fk_link_column_id` | `string` | ❌ No | Foreign Key to Link Column connecting levels |
| `enable_nested_records` | object | ❌ No | Enable nested records (Level 1 only) |
| `fk_self_link_column_id` | `string` | ❌ No | Foreign Key to Self-Link Column |
| `wrap_headers` | object | ❌ No | Wrap column headers in this level |
| `meta` | object | ❌ No | Meta data for this level |




---
## `List`

> Model for List View


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | `string` | ❌ No | The ID of the source that this view belongs to |
| `columns` | `array` [] | ❌ No | Columns in this view |
| `fk_view_id` | `string` | ❌ No | Foreign Key to View |
| `meta` | object | ❌ No | Meta data for this view |
| `order` | `number` | ❌ No | The order of the list |
| `base_id` | `string` | ❌ No | The ID of the base that this view belongs to |
| `show` | `boolean` | ❌ No | To show this view or not |
| `title` | `string` | ❌ No | Title of List View |
| `show_empty_parents` | object | ❌ No | Show empty parent sections |
| `row_height` | `number` | ❌ No | Row height for this list view |
| `fk_prefix_column_id` | object | ❌ No | Foreign Key to Prefix Column |
| `levels` | `array` [] | ❌ No | Levels configuration for this list view |




---
## `ListColumn`

> Model for List Column


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_id` | `string` | ❌ No | The ID of the source |
| `fk_column_id` | `string` | ❌ No | Foreign Key to Column |
| `fk_view_id` | `string` | ❌ No | Foreign Key to View |
| `fk_level_id` | `string` | ❌ No | Foreign Key to Level |
| `id` | `string` | ❌ No | Unique ID of List Column |
| `order` | `number` | ❌ No | The order in the list of columns |
| `base_id` | `string` | ❌ No | The ID of the base |
| `show` | `number` | ❌ No | Whether to show this column or not |
| `width` | `string` | ❌ No | Column width |




---
## `ListUpdateReq`

> Model for List View Update Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `meta` | object | ❌ No | Meta data for this view |
| `show_empty_parents` | object | ❌ No | Show empty parent sections |
| `row_height` | `number` | ❌ No | Row height for this list view |
| `fk_prefix_column_id` | object | ❌ No | Foreign Key to Prefix Column |
| `levels` | `array` [object] | ❌ No | Levels configuration for this list view |




---
## `ListViewLevelReq`

> Model for List View Level Request


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `level` | `number` | ✅ Yes | Level number (1, 2, or 3) |
| `fk_model_id` | `string` | ✅ Yes | Foreign Key to Model (table) for this level |
| `fk_link_column_id` | object | ❌ No | Foreign Key to Link Column |
| `enable_nested_records` | object | ❌ No | [Circular ref: #/components/schemas/Bool] |
| `fk_self_link_column_id` | object | ❌ No | Foreign Key to Self-Link Column |
| `wrap_headers` | object | ❌ No | Wrap column headers in this level |


**Required fields:** `level`, `fk_model_id`



---
## `WorkspaceUser`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` (email) | ❌ No | - |
| `fk_user_id` | `string` | ❌ No | - |
| `invite_accepted` | `boolean` | ❌ No | - |
| `invite_token` | `string` | ❌ No | - |
| `roles` | `string` | ❌ No | - |




---
## `WorkspaceUserInvite`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | `string` (email) | ❌ No | - |
| `roles` | `string` | ❌ No | - |




---
## `WorkspaceUserList`


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ❌ No | - |
| `pageInfo` | object | ❌ No | [Circular ref: #/components/schemas/Paginated] |




---
## `IntegrationList`

> Model for Integration List


**Type:** `object`


### Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `list` | `array` [] | ✅ Yes | List of Integration Models |
| `pageInfo` | object | ✅ Yes | Pagination Info |


**Required fields:** `list`, `pageInfo`



---
