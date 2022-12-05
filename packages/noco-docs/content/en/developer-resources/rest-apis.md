---
title: 'REST APIs'
description: 'NocoDB REST API Overview'
position: 1010
category: 'Developer Resources'
menuTitle: 'REST APIs'
---

Once you've created the schemas, you can manipulate the data or invoke actions using the REST APIs. We provide several types of APIs for different usages as below.

## API Overview

Here's the overview of all APIs. For the details, please check out <a href="https://all-apis.nocodb.com/" target="_blank">NocoDB API Documentation</a>. 

You may also interact with the API's resources via <a href="./accessing-apis#swagger-ui" target="_blank">Swagger UI</a>.

<alert type="success">
Currently, the default value for {orgs} is <b>noco</b>. Users will be able to change it in the future release.
</alert>

### Auth APIs

| Category | Method | Tag | Function Name | Path |
|---|---|---|---|---|
| Auth | Post | auth | signup | /api/v1/auth/user/signup |
| Auth | Post | auth | signin | /api/v1/auth/user/signin |
| Auth | Get | auth | me | /api/v1/auth/user/me |
| Auth | Post | auth | passwordForgot | /api/v1/auth/password/forgot |
| Auth | Post | auth | passwordChange | /api/v1/auth/password/change |
| Auth | Post | auth | passwordReset | /api/v1/auth/password/reset/{token} |
| Auth | Post | auth | tokenRefresh | /api/v1/auth/token/refresh |
| Auth | Post | auth | passwordResetTokenValidate | /api/v1/auth/token/validate/{token} |
| Auth | Post | auth | emailValidate | /api/v1/auth/email/validate/{email} |

### Public APIs

| Category | Method | Tag | Function Name | Path |
|---|---|---|---|---|
| Public | Get | public | sharedBaseGet | /api/v1/db/public/shared-base/{sharedBaseUuid}/meta |
| Public | Post | public | dataList | /api/v1/db/public/shared-view/{sharedViewUuid}/rows |
| Public | Get | public | dataNestedList | /api/v1/db/public/shared-view/{sharedViewUuid}/rows/{rowId}/{relationType}/{columnName} |
| Public | Post | public | dataCreate | /api/v1/db/public/shared-view/{sharedViewUuid}/rows |
| Public | Get | public | csvExport | /api/v1/db/public/shared-view/{sharedViewUuid}/rows/export/{type} |
| Public | Get | public | dataRelationList | /api/v1/db/public/shared-view/{sharedViewUuid}/nested/{columnName} |
| Public | Get | public | sharedViewMetaGet | /api/v1/db/public/shared-view/{sharedViewUuid}/meta |
| Public | Get | public | groupedDataList | /api/v1/db/public/shared-view/{sharedViewUuid}/group/{columnId} |

### Data APIs

| Category | Method | Tag | Function Name | Path |
|---|---|---|---|---|
| Data | Delete| dbTableRow | bulkDelete | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/ |
| Data | Post | dbTableRow | bulkCreate | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/ |
| Data | Patch | dbTableRow | bulkUpdate | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/ |
| Data | Patch | dbTableRow | bulkUpdateAll | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/all |
| Data | Delete| dbTableRow | bulkDeleteAll | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/all |
| Data | Get | dbTableRow | list | /api/v1/db/data/{orgs}/{projectName}/{tableName} |
| Data | Get | dbTableRow | findOne | /api/v1/db/data/{orgs}/{projectName}/{tableName}/find-one |
| Data | Get | dbTableRow | groupBy | /api/v1/db/data/{orgs}/{projectName}/{tableName}/groupby |
| Data | Get | dbTableRow | exist | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/exist |
| Data | Post | dbTableRow | create | /api/v1/db/data/{orgs}/{projectName}/{tableName} |
| Data | Get | dbTableRow | read | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId} |
| Data | Patch | dbTableRow | update | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId} |
| Data | Delete| dbTableRow | delete | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId} |
| Data | Get | dbTableRow | count | /api/v1/db/data/{orgs}/{projectName}/{tableName}/count |
| Data | Get | dbTableRow | groupedDataList | /api/v1/db/data/{orgs}/{projectName}/{tableName}/group/{columnId} |
| Data | Get | dbViewRow | list | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName} |
| Data | Get | dbViewRow | findOne | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/find-one |
| Data | Get | dbViewRow | groupBy | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/groupby |
| Data | Get | dbViewRow | exist | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}/exist |
| Data | Post | dbViewRow | create | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName} |
| Data | Get | dbViewRow | read | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId} |
| Data | Patch | dbViewRow | update | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId} |
| Data | Delete| dbViewRow | delete | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId} |
| Data | Get | dbViewRow | count | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/count |
| Data | Get | dbViewRow | groupedDataList | /api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/group/{columnId} |

### Meta APIs

| Category | Method | Tag | Function Name | Path |
|---|---|---|---|---|
| Meta | Get | apiToken | list | /api/v1/db/meta/projects/{projectId}/api-tokens |
| Meta | Post | apiToken | create | /api/v1/db/meta/projects/{projectId}/api-tokens |
| Meta | Delete| apiToken | delete | /api/v1/db/meta/projects/{projectId}/api-tokens/{token} |
| Meta | Get | auth | projectUserList | /api/v1/db/meta/projects/{projectId}/users |
| Meta | Post | auth | projectUserAdd | /api/v1/db/meta/projects/{projectId}/users |
| Meta | Patch | auth | projectUserUpdate | /api/v1/db/meta/projects/{projectId}/users/{userId} |
| Meta | Delete| auth | projectUserRemove | /api/v1/db/meta/projects/{projectId}/users/{userId} |
| Meta | Post | auth | projectUserResendInvite | /api/v1/db/meta/projects/{projectId}/users/{userId}/resend-invite |
| Meta | Post | dbTable | create | /api/v1/db/meta/projects/{projectId}/tables |
| Meta | Get | dbTable | list | /api/v1/db/meta/projects/{projectId}/tables |
| Meta | Post | dbTableColumn | create | /api/v1/db/meta/tables/{tableId}/columns |
| Meta | Patch | dbTableColumn | update | /api/v1/db/meta/tables/{tableId}/columns/{columnId} |
| Meta | Delete| dbTableColumn | delete | /api/v1/db/meta/tables/{tableId}/columns/{columnId} |
| Meta | Post | dbTableColumn | primaryColumnSet | /api/v1/db/meta/tables/{tableId}/columns/{columnId}/primary |
| Meta | Get | dbTableFilter | get | /api/v1/db/meta/filters/{filterId} |
| Meta | Patch | dbTableFilter | update | /api/v1/db/meta/filters/{filterId} |
| Meta | Delete| dbTableFilter | delete | /api/v1/db/meta/filters/{filterId} |
| Meta | Get | dbTableFilter | read | /api/v1/db/meta/views/{viewId}/filters |
| Meta | Post | dbTableFilter | create | /api/v1/db/meta/views/{viewId}/filters |
| Meta | Get | dbTableFilter | get | /api/v1/db/meta/filters/{filterId} |
| Meta | Patch | dbTableFilter | update | /api/v1/db/meta/filters/{filterId} |
| Meta | Delete| dbTableFilter | delete | /api/v1/db/meta/filters/{filterId} |
| Meta | Get | dbTableFilter | childrenRead | /api/v1/db/meta/filters/{filterGroupId}/children |
| Meta | Get | dbTableSort | list | /api/v1/db/meta/views/{viewId}/sorts |
| Meta | Post | dbTableSort | create | /api/v1/db/meta/views/{viewId}/sorts |
| Meta | Get | dbTableSort | read | /api/v1/db/meta/sorts/{sortId} |
| Meta | Patch | dbTableSort | update | /api/v1/db/meta/sorts/{sortId} |
| Meta | Delete| dbTableSort | delete | /api/v1/db/meta/sorts/{sortId}/api/v1/db |
| Meta | Patch | dbTableWebhook | update | /api/v1/db/meta/hooks/{hookId} |
| Meta | Delete| dbTableWebhook | delete | /api/v1/db/meta/hooks/{hookId} |
| Meta | Get | dbTableWebhook | list | /api/v1/db/meta/tables/{tableId}/hooks |
| Meta | Post | dbTableWebhook | create | /api/v1/db/meta/tables/{tableId}/hooks |
| Meta | Post | dbTableWebhook | test | /api/v1/db/meta/tables/{tableId}/hooks/test |
| Meta | Get | dbTableWebhook | samplePayloadGet | /api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{operation} |
| Meta | Get | dbTableWebhookFilter | read | /api/v1/db/meta/hooks/{hookId}/filters |
| Meta | Post | dbTableWebhookFilter | create | /api/v1/db/meta/hooks/{hookId}/filters |
| Meta | Get | dbView | list | /api/v1/db/meta/tables/{tableId}/views |
| Meta | Get | dbView | read | /api/v1/db/meta/tables/{tableId} |
| Meta | Patch | dbView | update | /api/v1/db/meta/tables/{tableId} |
| Meta | Delete| dbView | delete | /api/v1/db/meta/tables/{tableId} |
| Meta | Post | dbView | reorder | /api/v1/db/meta/tables/{tableId}/reorder |
| Meta | Post | dbView | formCreate | /api/v1/db/meta/forms |
| Meta | Patch | dbView | formUpdate | /api/v1/db/meta/forms/{formId} |
| Meta | Get | dbView | formRead | /api/v1/db/meta/forms/{formId} |
| Meta | Patch | dbView | formColumnUpdate | /api/v1/db/meta/form-columns/{formViewColumnId} |
| Meta | Post | dbView | galleryCreate | /api/v1/db/meta/galleries |
| Meta | Patch | dbView | galleryUpdate | /api/v1/db/meta/galleries/{galleriesId} |
| Meta | Get | dbView | galleryRead | /api/v1/db/meta/galleries/{galleriesId} |
| Meta | Post | dbView | gridCreate | /api/v1/db/meta/tables/${tableId}/grids |
| Meta | Get | dbView | gridColumnsList | /api/v1/db/meta/grids/{gridId}/grid-columns |
| Meta | Patch | dbView | gridColumnUpdate | /api/v1/db/meta/grid-columns/{columnId} |
| Meta | Patch | dbView | update | /api/v1/db/meta/views/{viewId} |
| Meta | Delete| dbView | delete | /api/v1/db/meta/views/{viewId} |
| Meta | Post | dbView | showAllColumn | /api/v1/db/meta/views/{viewId}/show-all |
| Meta | Post | dbView | hideAllColumn | /api/v1/db/meta/views/{viewId}/hide-all |
| Meta | Get | dbViewColumn | list | /api/v1/db/meta/views/{viewId}/columns |
| Meta | Post | dbViewColumn | create | /api/v1/db/meta/views/{viewId}/columns |
| Meta | Patch | dbViewColumn | update | /api/v1/db/meta/views/{viewId}/columns/{columnId} |
| Meta | Get | dbViewShare | list | /api/v1/db/meta/views/{viewId}/share |
| Meta | Post | dbViewShare | create | /api/v1/db/meta/views/{viewId}/share |
| Meta | Patch | dbViewShare | update | /api/v1/db/meta/views/{viewId}/share |
| Meta | Delete| dbViewShare | delete | /api/v1/db/meta/views/{viewId}/share |
| Meta | Get | plugin | list | /api/v1/db/meta/plugins |
| Meta | Get | plugin | status | /api/v1/db/meta/plugins/{pluginTitle}/status |
| Meta | Post | plugin | test | /api/v1/db/meta/plugins/test |
| Meta | PATCH | plugin | update | /api/v1/db/meta/plugins/{pluginId} |
| Meta | Get | plugin | read | /api/v1/db/meta/plugins/{pluginId} |
| Meta | Get | project | metaGet | /api/v1/db/meta/projects/{projectId}/info |
| Meta | Get | project | modelVisibilityList | /api/v1/db/meta/projects/{projectId}/visibility-rules |
| Meta | Post | project | modelVisibilitySet | /api/v1/db/meta/projects/{projectId}/visibility-rules |
| Meta | Get | project | list | /api/v1/db/meta/projects |
| Meta | Post | project | create | /api/v1/db/meta/projects |
| Meta | Get | project | read | /api/v1/db/meta/projects/{projectId} |
| Meta | Delete| project | delete | /api/v1/db/meta/projects/{projectId} |
| Meta | Get | project | auditList | /api/v1/db/meta/projects/{projectId}/audits |
| Meta | Get | project | metaDiffGet | /api/v1/db/meta/projects/{projectId}/meta-diff |
| Meta | Post | project | metaDiffSync | /api/v1/db/meta/projects/{projectId}/meta-diff |
| Meta | Get | project | sharedBaseGet | /api/v1/db/meta/projects/{projectId}/shared |
| Meta | Delete| project | sharedBaseDisable | /api/v1/db/meta/projects/{projectId}/shared |
| Meta | Post | project | sharedBaseCreate | /api/v1/db/meta/projects/{projectId}/shared |
| Meta | Patch | project | sharedBaseUpdate | /api/v1/db/meta/projects/{projectId}/shared |
| Meta | Post | storage | upload | /api/v1/db/storage/upload |
| Meta | Post | storage | uploadByUrl | /api/v1/db/storage/upload-by-url |
| Meta | Get | utils | commentList | /api/v1/db/meta/audits/comments |
| Meta | Post | utils | commentRow | /api/v1/db/meta/audits/comments |
| Meta | Get | utils | commentCount | /api/v1/db/meta/audits/comments/count |
| Meta | Post | utils | auditRowUpdate | /api/v1/db/meta/audits/update |
| Meta | Get | utils | cacheGet | /api/v1/db/meta/cache |
| Meta | Delete| utils | cacheDelete | /api/v1/db/meta/cache |
| Meta | Post | utils | testConnection | /api/v1/db/meta/projects/connection/test |
| Meta | Get | utils | appInfo | /api/v1/db/meta/nocodb/info |
| Meta | Get | utils | appVersion | /api/v1/version |
| Meta | Get | utils | appHealth | /api/v1/health |
| Meta | Get | utils | aggregatedMetaInfo | /api/v1/aggregated-meta-info |
| Meta | Get | orgUsers | list | /api/v1/users |
| Meta | Post | orgUsers | add | /api/v1/users |
| Meta | Patch | orgUsers | update | /api/v1/users/{userId} |
| Meta | Delete | orgUsers | delete | /api/v1/users/{userId} |
| Meta | Get | orgTokens | list | /api/v1/tokens |
| Meta | Post | orgTokens | create | /api/v1/tokens |
| Meta | Delete | orgTokens | delete | /api/v1/tokens/{token} |
| Meta | Get | orgAppSettings | get | /api/v1/app-settings |
| Meta | Post | orgAppSettings | set | /api/v1/app-settings |

## Query params

|  **Name**    | **Alias** | **Use case** | **Default value**  |**Example value**  |
|---|---|---|---|---|
|  [where](#comparison-operators)  | [w](#comparison-operators)  |  Complicated where conditions | | `(colName,eq,colValue)~or(colName2,gt,colValue2)` <br />[Usage: Comparison operators](#comparison-operators) <br />[Usage: Logical operators](#logical-operators) |
|  limit  | l |  Number of rows to get (SQL limit value)  | 10  | 20 |
|  offset  | o |  Offset for pagination (SQL offset value)  | 0  | 20 |
|  sort  | s |  Sort by column name, Use `-` as prefix for descending sort  |   | column_name |
|  fields  | f |  Required column names in result  |  * | column_name1,column_name2 |
|  shuffle  | r |  Shuffle the result for pagination |  0 | 1 (Only allow 0 or 1. Other values would see it as 0) |

<!-- 
|  fields1  | f1 |  Required column names in child result  |  * | column_name1,column_name2 |
|  bt  |  |  Comma-separated belongs to tables  | `All belongs to tables` | [click here for example](#nested-parentbelongs-to) |
|  bfields`<p>`  | bf`<p>`  |  Required belongs to table column names in result. Where `<p>` refers to position of table name in `bt` parameter(starts from `1`)  | primary key and primary value | [click here for example](#nested-parentbelongs-to) |
|  hm  |  |  Comma-separated has many tables  | `All hasmany tables` | [click here for example](#nested-childrenhas-many) |
|  hfields`<p>`  | hf`<p>`  |  Required has many table column names in result. Where `<p>` refers to position of table name in `hm` parameter(starts from `1`) | primary key and primary value | [click here for example](#nested-childrenhas-many) |
|  mm  |  |  Comma-separated many to many tables  | `All many to many tables` | [click here for example](#nested-childrenmany-to-many) |
|  mfields`<p>`  | mf`<p>`  |  Required many to many table column names in result. Where `<p>` refers to position of table name in `mm` parameter(starts from `1`) | primary key and primary value | [click here for example](#nested-childrenmany-to-many) |
 -->

## Comparison Operators

| Operation | Meaning | Example |
|---|---|---|
| eq | equal | (colName,eq,colValue) |
| neq | not equal | (colName,neq,colValue) |
| not | not equal (alias of neq) | (colName,not,colValue) |
| gt | greater than | (colName,gt,colValue) |
| ge | greater or equal | (colName,ge,colValue) |
| lt | less than | (colName,lt,colValue) |
| le | less or equal | (colName,le,colValue) |
| is | is | (colName,is,true/false/null) |
| isnot | is not | (colName,isnot,true/false/null) |
| in | in | (colName,in,val1,val2,val3,val4) |
| btw | between | (colName,btw,val1,val2) |
| nbtw | not between | (colName,nbtw,val1,val2) |
| like | like | (colName,like,%name) |

## Logical Operators

| Operation | Example |
|---|---|
| ~or | (checkNumber,eq,JM555205)~or((amount, gt, 200)~and(amount, lt, 2000)) |
| ~and | (checkNumber,eq,JM555205)~and((amount, gt, 200)~and(amount, lt, 2000)) |
| ~not | ~not(checkNumber,eq,JM555205) |
