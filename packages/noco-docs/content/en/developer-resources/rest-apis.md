---
title: 'REST APIs'
position: 1010
category: 'Developer Resources'
menuTitle: 'REST APIs'
---

Once you've created the schemas, you can manipulate the data or invoke actions using the REST APIs. We provide several types of APIs for different usages as below.

## API Overview

### Public APIs

| Category | Method | Operation | Path |
|---|---|---|---|
| Public | Get |  | /api/v1/db/public/sharedBase/{sharedBaseUuid} |
| Public | Post |  | /api/v1/db/public/data/{uuid}/list |
| Public | Get |  | /api/v1/db/public/data/{uuid}/{rowId}/{relationType}/{columnId} |
| Public | Get |  | /api/v1/db/public/data/{uuid}/{rowId}/{relationType}/{columnId}/exclude |
| Public | Post |  | /api/v1/db/public/data/{uuid}/create |
| Public | Post |  | /api/v1/db/public/data/{uuid}/export/{type} |
| Public | Post |  | /api/v1/db/public/data/{uuid}/relationTable/{relationColumnId} |
| Public | Post |  | /api/v1/db/public/meta/{uuid} |

### Data APIs

| Category | Method | Operation | Path |
|---|---|---|---|
| Data | Del | TableBulkDataDelete | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/ |
| Data | Post | TableBulkDataCreate | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/ |
| Data | Patch | TableBulkDataUpdate | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/ |
| Data | Patch | TableBulkDataUpdateAll | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/all |
| Data | Del | TableBulkDataDeleteAll | /api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/all |
| Data | Get | TableDataByNameList | /api/v1/db/data/{orgs}/{projectName}/{tableName} |
| Data | Post | TableDataByNameCreate | /api/v1/db/data/{orgs}/{projectName}/{tableName} |
| Data | Get | TableDataByNameRead | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId} |
| Data | Put | TableDataByNameUpdate | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId} |
| Data | Del | TableDataByNameDelete | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId} |
| Data | Get | TableViewDataList | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{viewName} |
| Data | Post | TableViewDataCreate | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{viewName} |
| Data | Get | TableViewDataRead | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{viewName}/{rowId} |
| Data | Put | TableViewDataUpdate | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{viewName}/{rowId} |
| Data | Del | TableViewDataDelete | /api/v1/db/data/{orgs}/{projectName}/{tableName}/{viewName}/{rowId} |

### Meta APIs

| Category | Method | Operation | Path |
|---|---|---|---|
| Meta | Get | AuditCommentList | /api/v1/db/meta/audits/comments |
| Meta | Post | AuditCommentCreate | /api/v1/db/meta/audits/comments |
| Meta | Get | AuditCommentCount | /api/v1/db/meta/audits/comments/count |
| Meta | Post | AuditUpdate | /api/v1/db/meta/audits/update |
| Meta | Get | CacheRead | /api/v1/db/meta/cache |
| Meta | Del | CacheDelete | /api/v1/db/meta/cache |
| Meta | Get | HookFiltersList | /api/v1/db/meta/hooks/{hookId}/filters |
| Meta | Post | HookFiltersCreate | /api/v1/db/meta/hooks/{hookId}/filters |
| Meta | Get | HookFiltersRead | /api/v1/db/meta/filters/{filterId} |
| Meta | Put | HookFiltersUpdate | /api/v1/db/meta/filters/{filterId} |
| Meta | Del | HookFiltersDelete | /api/v1/db/meta/filters/{filterId} |
| Meta | Get |  | /api/v1/db/meta/filters/{filterId}/children |
| Meta | Put | HookUpdate | /api/v1/db/meta/hooks/{hookId} |
| Meta | Del | HookDelete | /api/v1/db/meta/hooks/{hookId} |
| Meta | Post | TestConnection | /api/v1/db/meta/projects/connection/test |
| Meta | Get | AppInfoRead | /api/v1/db/meta/nocodb/info |
| Meta | Get | PluginsList | /api/v1/db/meta/plugins |
| Meta | Get | PluginsReadStatus | /api/v1/db/meta/plugins/{pluginTitle}/status |
| Meta | Post | PluginsTest | /api/v1/db/meta/plugins/test |
| Meta | Put | PluginsUpdate | /api/v1/db/meta/plugins/{pluginId} |
| Meta | Get | PluginsRead | /api/v1/db/meta/plugins/{pluginId} |
| Meta | Get | ProjectsRead | /api/v1/db/meta/projects/{projectId}/info |
| Meta | Get | ProjectView-visibilityRead | /api/v1/db/meta/projects/{projectId}/visibility-rules |
| Meta | Post | ProjectView-visibilityUpdate | /api/v1/db/meta/projects/{projectId}/visibility-rules |
| Meta | Get | ProjectList | /api/v1/db/meta/projects |
| Meta | Post | ProjectCreate | /api/v1/db/meta/projects |
| Meta | Get | ProjectRead | /api/v1/db/meta/projects/{projectId} |
| Meta | Del | ProjectDelete | /api/v1/db/meta/projects/{projectId} |
| Meta | Get | ProjectApiTokensList | /api/v1/db/meta/projects/{projectId}/apiTokens |
| Meta | Post | ProjectApiTokensCreate | /api/v1/db/meta/projects/{projectId}/apiTokens |
| Meta | Del | ProjectApiTokensDelete | /api/v1/db/meta/projects/{projectId}/apiTokens/{apiTokenId} |
| Meta | Get | ProjectAuditsList | /api/v1/db/meta/projects/{projectId}/audits |
| Meta | Get | ProjectMetaDiffList | /api/v1/db/meta/projects/{projectId}/meta-diff |
| Meta | Post | ProjectMetaDiffSync | /api/v1/db/meta/projects/{projectId}/meta-diff |
| Meta | Get | ProjectSharedBaseList | /api/v1/db/meta/projects/{projectId}/shared |
| Meta | Del | ProjectSharedBaseDelete | /api/v1/db/meta/projects/{projectId}/shared |
| Meta | Post | ProjectSharedBaseCreate | /api/v1/db/meta/projects/{projectId}/shared |
| Meta | Put | ProjectSharedBaseUpdate | /api/v1/db/meta/projects/{projectId}/shared |
| Meta | Post | ProjectTablesCreate | /api/v1/db/meta/projects/{projectId}/tables |
| Meta | Get | ProjectTablesList | /api/v1/db/meta/projects/{projectId}/tables |
| Meta | Get | ProjectUserList | /api/v1/db/meta/projects/{projectId}/users |
| Meta | Post | ProjectUserCreate | /api/v1/db/meta/projects/{projectId}/users |
| Meta | Put | ProjectUserUpdate | /api/v1/db/meta/projects/{projectId}/users/{userId} |
| Meta | Del | ProjectUserDelete | /api/v1/db/meta/projects/{projectId}/users/{userId} |
| Meta | Post | ProjectViewUpload | /api/v1/db/meta/projects/{projectId}/views/{viewId}/upload |
| Meta | Get | TableHooksList | /api/v1/db/meta/tables/{tableId}/hooks |
| Meta | Post | TableHooksCreate | /api/v1/db/meta/tables/{tableId}/hooks |
| Meta | Post | TableHooksTest | /api/v1/db/meta/tables/{tableId}/hooks/test |
| Meta | Get | TableHooksSamplePayload | /api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{operation} |
| Meta | Get | Table | /api/v1/db/meta/tables/{tableId}/views |
| Meta | Get | TablesRead | /api/v1/db/meta/tables/{tableId} |
| Meta | Put | TablesUpdate | /api/v1/db/meta/tables/{tableId} |
| Meta | Del | TablesDelete | /api/v1/db/meta/tables/{tableId} |
| Meta | Post | TablesReorder | /api/v1/db/meta/tables/{tableId}/reorder |
| Meta | Get | TableColumnsList | /api/v1/db/meta/tables/{tableId}/columns |
| Meta | Post | TableColumnsCreate | /api/v1/db/meta/tables/{tableId}/columns |
| Meta | Get | TableColumnsRead | /api/v1/db/meta/tables/{tableId}/columns/{columnId} |
| Meta | Put | TableColumnsUpdate | /api/v1/db/meta/tables/{tableId}/columns/{columnId} |
| Meta | Del | TableColumnsDelete | /api/v1/db/meta/tables/{tableId}/columns/{columnId} |
| Meta | Post | TableColumnsSetPrimary | /api/v1/db/meta/tables/{tableId}/columns/{columnId}/primary |
| Meta | Post | TablesFormViewCreate | /api/v1/db/meta/forms |
| Meta | Put | TablesFormViewUpdate | /api/v1/db/meta/forms/{formId} |
| Meta | Del | TablesFormViewDelete | /api/v1/db/meta/forms/{formId} |
| Meta | Get | TablesFormViewRead | /api/v1/db/meta/forms/{formId} |
| Meta | Put | TablesFormViewColumnUpdate | /api/v1/db/meta/forms/columns/{columnId} |
| Meta | Post | TablesGalleryViewCreate | /api/v1/db/meta/galleries |
| Meta | Put | TablesGalleryViewUpdate | /api/v1/db/meta/galleries/{galleriesId} |
| Meta | Del | TablesGalleryViewDelete | /api/v1/db/meta/galleries/{galleriesId} |
| Meta | Get | TablesGalleryViewRead | /api/v1/db/meta/galleries/{galleriesId} |
| Meta | Post | TablesGridViewCreate | /api/v1/db/meta/grids |
| Meta | Put | TablesGridViewUpdate | /api/v1/db/meta/grids/{gridId} |
| Meta | Del | TablesGridViewDelete | /api/v1/db/meta/grids/{gridId} |
| Meta | Get | TablesGridViewRead | /api/v1/db/meta/grids/{gridId} |
| Meta | Get | TablesGridViewColumnread | /api/v1/db/meta/grids/{gridId}/columns |
| Meta | Put | TablesGridViewColumnUpdate | /api/v1/db/meta/grid/columns/{gridcolumnId} |
| Meta | Get | ViewColumnsList | /api/v1/db/meta/views/{viewId}/columns |
| Meta | Post | ViewColumnsCreate | /api/v1/db/meta/views/{viewId}/columns |
| Meta | Get | ViewColumnsRead | /api/v1/db/meta/views/{viewId}/columns/{columnId} |
| Meta | Put | ViewColumnsUpdate | /api/v1/db/meta/views/{viewId}/columns/{columnId} |
| Meta | Get | ViewFiltersList | /api/v1/db/meta/views/{viewId}/filters |
| Meta | Post | ViewFiltersCreate | /api/v1/db/meta/views/{viewId}/filters |
| Meta | Get | ViewColumnsRead | /api/v1/db/meta/views/{viewId}/filters/{filterId} |
| Meta | Put | ViewColumnsUpdate | /api/v1/db/meta/views/{viewId}/filters/{filterId} |
| Meta | Del | ViewColumnsDelete | /api/v1/db/meta/views/{viewId}/filters/{filterId} |
| Meta | Get | ViewFiltersChildren | /api/v1/db/meta/views/{viewId}/filters/{filterGroupId}/children |
| Meta | Put | ViewsUpdate | /api/v1/db/meta/views/{viewId} |
| Meta | Del | ViewsDelete | /api/v1/db/meta/views/{viewId} |
| Meta | Post | ViewsShowAll | /api/v1/db/meta/views/{viewId}/showAll |
| Meta | Post | ViewsHideAll | /api/v1/db/meta/views/{viewId}/hideAll |
| Meta | Get | ViewShareList | /api/v1/db/meta/views/{viewId}/share |
| Meta | Post | ViewSharCreate | /api/v1/db/meta/views/{viewId}/share |
| Meta | Put | ViewShareUpdate | /api/v1/db/meta/views/{viewId}/share |
| Meta | Del | ViewShareDelete | /api/v1/db/meta/views/{viewId}/share |
| Meta | Get | ViewSortsList | /api/v1/db/meta/views/{viewId}/sorts |
| Meta | Post | ViewSortsCreate | /api/v1/db/meta/views/{viewId}/sorts |
| Meta | Get | ViewSortsRead | /api/v1/db/meta/views/{viewId}/sorts/{sortId} |
| Meta | Put | ViewSortsUpdate | /api/v1/db/meta/views/{viewId}/sorts/{sortId} |
| Meta | Del | ViewSortsDelete | /api/v1/db/meta/views/{viewId}/sorts/{sortId}/api/v1/db |

### Auth APIs

| Category | Method | Operation | Path |
|---|---|---|---|
| Auth | Post | SignIn | /api/v1/db/auth/user/signup |
| Auth | Post | SignUp | /api/v1/db/auth/user/signin |
| Auth | Get | ReadUserInfo | /api/v1/db/auth/user/me |
| Auth | Post | PasswordForgot | /api/v1/db/auth/user/password/forgot |
| Auth | Post | PasswordChange | /api/v1/db/auth/user/password/change |
| Auth | Post | PasswordReset | /api/v1/db/auth/user/password/reset/{token} |
| Auth | Post | TokenVerify | /api/v1/db/auth/user/token/verify |
| Auth | Post | TokenRefresh | /api/v1/db/auth/user/token/refresh |
| Auth | Post | TokenValidate | /api/v1/db/auth/user/token/validate/{token} |
| Auth | Post | EmailValidate | /api/v1/db/auth/user/email/validate/{email} |

<!-- TODO: verify -->

## Query params

|  **Name**    | **Alias** | **Use case** | **Default value**  |**Example value**  |
|---|---|---|---|---|
|  [where](#comparison-operators)  | [w](#comparison-operators)  |  Complicated where conditions | | `(colName,eq,colValue)~or(colName2,gt,colValue2)` <br />[Usage: Comparison operators](#comparison-operators) <br />[Usage: Logical operators](#logical-operators) |
|  limit  | l |  Number of rows to get(SQL limit value)  | 10  | 20 |
|  offset  | o |  Offset for pagination(SQL offset value)  | 0  | 20 |
|  sort  | s |  Sort by column name, Use `-` as prefix for descending sort  |   | column_name |
|  fields  | f |  Required column names in result  |  * | column_name1,column_name2 |
|  fields1  | f1 |  Required column names in child result  |  * | column_name1,column_name2 |
|  bt  |  |  Comma-separated belongs to tables  | `All belongs to tables` | [click here for example](#nested-parentbelongs-to) |
|  bfields`<p>`  | bf`<p>`  |  Required belongs to table column names in result. Where `<p>` refers to position of table name in `bt` parameter(starts from `1`)  | primary key and primary value | [click here for example](#nested-parentbelongs-to) |
|  hm  |  |  Comma-separated has many tables  | `All hasmany tables` | [click here for example](#nested-childrenhas-many) |
|  hfields`<p>`  | hf`<p>`  |  Required has many table column names in result. Where `<p>` refers to position of table name in `hm` parameter(starts from `1`) | primary key and primary value | [click here for example](#nested-childrenhas-many) |
|  mm  |  |  Comma-separated many to many tables  | `All many to many tables` | [click here for example](#nested-childrenmany-to-many) |
|  mfields`<p>`  | mf`<p>`  |  Required many to many table column names in result. Where `<p>` refers to position of table name in `mm` parameter(starts from `1`) | primary key and primary value | [click here for example](#nested-childrenmany-to-many) |

## Comparison operators

```
eq      -   '='         -  (colName,eq,colValue)
not     -   '!='        -  (colName,not,colValue)
gt      -   '>'         -  (colName,gt,colValue)
ge      -   '>='        -  (colName,ge,colValue)
lt      -   '<'         -  (colName,lt,colValue)
le      -   '<='        -  (colName,le,colValue)
is      -   'is'        -  (colName,is,true/false/null)
isnot   -   'is not'    -  (colName,isnot,true/false/null)
in      -   'in'        -  (colName,in,val1,val2,val3,val4)
btw     -   'between'   -  (colName,btw,val1,val2) 
nbtw    -  'not between'-  (colName,nbtw,val1,val2) 
like    -   'like'      -  (colName,like,%name)
```

#### Example use of comparison operators - complex example
```
<API_PATH>?where=(checkNumber,eq,JM555205)~or((amount,gt,200)~and(amount,lt,2000))
```

#### Logical operators
```
~or     -   'or'
~and    -   'and'
~not    -   'not'
```