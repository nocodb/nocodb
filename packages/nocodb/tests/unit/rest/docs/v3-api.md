# V3 API Unit Tests — Flat Table

> Generated: 2026-03-06
> Source: `packages/nocodb/tests/unit/rest/tests/{dataApiV3,metaApiV3,internal}/`

| # | API | Operation | Method + URL | Description | Expected | Err? | Error Code |
|---|-----|-----------|-------------|-------------|----------|------|------------|
| 1 | Teams | Invalid params/duplicates | Various | Invalid params, duplicates, not-found | 400/404/422 | Y | ERR_INVALID_REQUEST_BODY / ERR_RECORD_NOT_FOUND |
| 2 | Base Teams | Not found | Various | Non-existent team/invite | 404 | Y | ERR_RECORD_NOT_FOUND |
| 3 | Scripts | Invalid/duplicate errors | Various | Invalid base/script IDs, duplicate names | 400/404/422 | Y | ERR_INVALID_REQUEST_BODY / ERR_RECORD_NOT_FOUND |
| 4 | Unique Constraint | Multi-field combos | Various | Multi-field constraints, null handling | 200/422 | N |  |
| 5 | Table Visibility | Various combos | Various | Multiple role/user/team combos | 200/403 | N |  |
| 6 | Table Visibility | Role hierarchy check | `GET` (access check) | Owner>Creator>Editor>Viewer | 200/403 | N |  |
| 7 | Attachment | Signed URL | `GET` (signed URL endpoint) | Get signed URL for attachment | 200 | N |  |
| 8 | Audit | Bulk insert + update log | `POST+PATCH .../records` (bulk) then `GET` audit | Audit log for bulk operations | 200 | N |  |
| 9 | Audit | Single insert + update log | `POST+PATCH .../records` then `GET /api/v2/internal/:wsId/:baseId` | Audit log created after insert & update | 200 | N |  |
| 10 | Records | Backward compat v1 | `GET /api/v1/abcasdasda` | Old v1 404 format | 404 | Y | NOT_FOUND (legacy format) |
| 11 | Records | Backward compat v2 | `GET /api/v2/abcasdasda` | Old v2 404 format | 404 | Y | NOT_FOUND (legacy format) |
| 12 | Table Visibility | Set by user | `POST /api/v2/internal/...` | Set table visibility per user | 200 | N |  |
| 13 | Table Visibility | Set nobody | `POST /api/v2/internal/...` | Hide table from everyone | 200 | N |  |
| 14 | Table Visibility | Team self_only | `POST /api/v2/internal/...` | Team permission self_only scope | 200 | N |  |
| 15 | Table Visibility | Team self_and_descendants | `POST /api/v2/internal/...` | Team permission with descendants | 200 | N |  |
| 16 | Table Visibility | Set by role | `POST /api/v2/internal/...?op=tableVisibilitySet` | Set table visibility per role | 200 | N |  |
| 17 | Timeline | Get view | `GET /api/v2/internal/:wsId/:baseId` | Get timeline view config | 200 | N |  |
| 18 | Timeline | List range columns | `GET /api/v2/internal/:wsId/:baseId` | List timeline ranges | 200 | N |  |
| 19 | Timeline | Create view | `POST /api/v2/internal/:wsId/:baseId` | Create timeline view | 200 | N |  |
| 20 | Timeline | Add range column | `POST /api/v2/internal/:wsId/:baseId` | Add date range to timeline | 200 | N |  |
| 21 | Timeline | Update view | `PATCH /api/v2/internal/:wsId/:baseId` | Update timeline config | 200 | N |  |
| 22 | Timeline | Update range | `PATCH /api/v2/internal/:wsId/:baseId` | Update range config | 200 | N |  |
| 23 | Timeline | Delete view | `DELETE /api/v2/internal/:wsId/:baseId` | Delete timeline view | 200 | N |  |
| 24 | Timeline | Delete range | `DELETE /api/v2/internal/:wsId/:baseId` | Delete range | 200 | N |  |
| 25 | UI View | List views | `GET /api/v2/internal/:wsId/:baseId?op=viewList&tableId=:tableId` | List all views for table | 200 | N |  |
| 26 | UI View | List with default grid | `GET /api/v2/internal/:wsId/:baseId?op=viewList&tableId=:tableId` | Default grid view exists | 200 | N |  |
| 27 | Records | Base not found | `GET /api/v3/data/234567890/123456789/records` | Non-existent base | 422 | Y | ERR_BASE_NOT_FOUND |
| 28 | Records | List (invalid table ID) | `GET /api/v3/data/:baseId/123456789/records` | Invalid table ID | 422 | Y | ERR_TABLE_NOT_FOUND |
| 29 | Records | Table not found | `GET /api/v3/data/:baseId/123456789/records` | Non-existent table | 422 | Y | ERR_TABLE_NOT_FOUND |
| 30 | Records | Create (invalid table) | `POST /api/v3/data/:baseId/123456789/records` | Invalid table ID | 422 | Y | ERR_TABLE_NOT_FOUND |
| 31 | Records | Update (invalid table) | `PATCH /api/v3/data/:baseId/123456789/records` | Invalid table ID | 422 | Y | ERR_TABLE_NOT_FOUND |
| 32 | Records | Delete (invalid table) | `DELETE /api/v3/data/:baseId/123456789/records` | Invalid table ID | 422 | Y | ERR_TABLE_NOT_FOUND |
| 33 | Records | Count (viewId) | `GET /api/v3/data/:baseId/:tableId/count?viewId=:viewId` | Count records with view filter | 200 | N |  |
| 34 | Links | HM list | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | List Has-Many linked records | 200 | N |  |
| 35 | Links | MM list | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | List Many-Many linked records | 200 | N |  |
| 36 | Links | HM list: invalid table | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID | 422 | Y | ERR_TABLE_NOT_FOUND |
| 37 | Links | HM list: invalid link | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 38 | Links | HM list: invalid row | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 39 | Links | HM list: invalid offset/limit | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Negative/string offset & limit | 200 | Y | (message only) |
| 40 | Links | HM list: offset > total | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Offset exceeds total records | 422 | Y | (message only) |
| 41 | Links | BT list: invalid table | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID (BT) | 422 | Y | ERR_TABLE_NOT_FOUND |
| 42 | Links | BT list: invalid link | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID (BT) | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 43 | Links | BT list: invalid row | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID (BT) | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 44 | Links | MM list: invalid table | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID (MM) | 422 | Y | ERR_TABLE_NOT_FOUND |
| 45 | Links | MM list: invalid link | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID (MM) | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 46 | Links | MM list: invalid row | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID (MM) | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 47 | Links | HM add | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Add Has-Many links | 200 | N |  |
| 48 | Links | MM add | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Add Many-Many links | 200 | N |  |
| 49 | Links | HM change parent | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Change existing HM link to new parent | 200 | N |  |
| 50 | Links | HM add: invalid table | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID | 422 | Y | ERR_TABLE_NOT_FOUND |
| 51 | Links | HM add: invalid link | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 52 | Links | HM add: invalid row | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 53 | Links | HM add: invalid body IDs | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Non-existent target row IDs | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 54 | Links | HM add: duplicate IDs | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Repeated row IDs in body | 422 | Y | (msg: already exists) |
| 55 | Links | BT add: invalid table | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID (BT) | 422 | Y | ERR_TABLE_NOT_FOUND |
| 56 | Links | BT add: invalid link | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID (BT) | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 57 | Links | BT add: invalid row | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID (BT) | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 58 | Links | BT add: invalid body ID | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Non-existent parent row ID | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 59 | Links | MM add: invalid table | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID (MM) | 422 | Y | ERR_TABLE_NOT_FOUND |
| 60 | Links | MM add: invalid link | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID (MM) | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 61 | Links | MM add: invalid row | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID (MM) | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 62 | Links | MM add: invalid body IDs | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Non-existent target row IDs (MM) | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 63 | Links | MM add: duplicate IDs | `POST /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Repeated row IDs in body (MM) | 422 | Y | (msg: already exists) |
| 64 | Links | HM remove | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Remove Has-Many links | 200 | N |  |
| 65 | Links | MM remove | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Remove Many-Many links | 200 | N |  |
| 66 | Links | HM remove: invalid table | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID | 422 | Y | ERR_TABLE_NOT_FOUND |
| 67 | Links | HM remove: invalid link | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 68 | Links | HM remove: invalid row | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 69 | Links | HM remove: invalid body IDs | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Non-existent target row IDs | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 70 | Links | HM remove: duplicate IDs | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Repeated row IDs in body | 422 | Y | (msg: already exists) |
| 71 | Links | BT remove: invalid table | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID (BT) | 422 | Y | ERR_TABLE_NOT_FOUND |
| 72 | Links | BT remove: invalid link | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID (BT) | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 73 | Links | BT remove: invalid row | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID (BT) | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 74 | Links | BT remove: multi IDs | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | BT only allows 1 parent ID | 422 | Y | (msg: only 1 parent) |
| 75 | Links | MM remove: invalid table | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid table ID (MM) | 422 | Y | ERR_TABLE_NOT_FOUND |
| 76 | Links | MM remove: invalid link | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid link ID (MM) | 422 | Y | ERR_FIELD_NOT_FOUND (msg) |
| 77 | Links | MM remove: invalid row | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Invalid source row ID (MM) | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 78 | Links | MM remove: invalid body IDs | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Non-existent target row IDs (MM) | 404 | Y | ERR_RECORD_NOT_FOUND (msg) |
| 79 | Links | MM remove: duplicate IDs | `DELETE /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId` | Repeated row IDs in body (MM) | 422 | Y | (msg: already exists) |
| 80 | Links | Limit/offset | `GET /api/v3/data/:baseId/:tableId/links/:linkId/records/:rowId?limit=10&offset=0` | Paginated link listing | 200 | N |  |
| 81 | Records | List (default) | `GET /api/v3/data/:baseId/:tableId/records` | Default list (text-based) | 200 | N |  |
| 82 | Records | No auth token | `GET /api/v3/data/:baseId/:tableId/records` | Missing authentication header | 401 | Y | ERR_AUTHENTICATION_REQUIRED |
| 83 | Records | Invalid token | `GET /api/v3/data/:baseId/:tableId/records` | Invalid xc-token | 401 | Y | ERR_AUTHENTICATION_REQUIRED |
| 84 | Records | No permission | `GET /api/v3/data/:baseId/:tableId/records` | Unauthorized access (wrong user) | 403 | Y | ERR_FORBIDDEN |
| 85 | Records | Create (all fields) | `POST /api/v3/data/:baseId/:tableId/records` | Insert with all text fields | 200 | N |  |
| 86 | Records | Create (partial) | `POST /api/v3/data/:baseId/:tableId/records` | Insert with some fields, rest null | 200 | N |  |
| 87 | Records | Create (bulk) | `POST /api/v3/data/:baseId/:tableId/records` | Bulk insert 3 records | 200 | N |  |
| 88 | Records | Create (column id) | `POST /api/v3/data/:baseId/:tableId/records` | Insert using column IDs instead of titles | 200 | N |  |
| 89 | Records | Create (bulk column id) | `POST /api/v3/data/:baseId/:tableId/records` | Bulk insert using column IDs | 200 | N |  |
| 90 | Records | Create (link insert) | `POST /api/v3/data/:baseId/:tableId/records` | Insert with LTAR field `{Cities:[{id:1}]}` | 200 | N |  |
| 91 | Records | Create (user email) | `POST /api/v3/data/:baseId/:tableId/records` | Insert user field by email | 200 | N |  |
| 92 | Records | Create (user ID) | `POST /api/v3/data/:baseId/:tableId/records` | Insert user field by user ID | 200 | N |  |
| 93 | Records | Create (checkbox valid) | `POST /api/v3/data/:baseId/:tableId/records` | Insert checkbox with all valid formats | 200 | N |  |
| 94 | Records | Invalid email format | `POST /api/v3/data/:baseId/:tableId/records` | Invalid email value on insert | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 95 | Records | Extra body properties | `POST /api/v3/data/:baseId/:tableId/records` | Properties outside `fields` | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 96 | Records | Insert empty array | `POST /api/v3/data/:baseId/:tableId/records` | Zero records (no-op) | 200 | Y | (no-op, returns 200) |
| 97 | Records | Insert invalid number | `POST /api/v3/data/:baseId/:tableId/records` | String for Number field | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 98 | Records | Insert invalid rating | `POST /api/v3/data/:baseId/:tableId/records` | Invalid rating (HELLO/-1/9999) | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 99 | Records | Insert invalid year | `POST /api/v3/data/:baseId/:tableId/records` | Invalid year (99/19999/HELLO) | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 100 | Records | Insert invalid duration | `POST /api/v3/data/:baseId/:tableId/records` | Invalid duration (HELLO/-1) | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 101 | Records | Insert >10 records | `POST /api/v3/data/:baseId/:tableId/records` | Exceeds max batch size (29) | 422 | Y | ERR_MAX_PAYLOAD_LIMIT_EXCEEDED |
| 102 | Records | Insert invalid date | `POST /api/v3/data/:baseId/:tableId/records` | Invalid date value | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 103 | Records | Insert invalid single select | `POST /api/v3/data/:baseId/:tableId/records` | Value outside select options | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 104 | Records | Insert invalid multi select | `POST /api/v3/data/:baseId/:tableId/records` | Values outside select options | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 105 | Records | Insert invalid checkbox | `POST /api/v3/data/:baseId/:tableId/records` | Invalid checkbox value | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 106 | Records | Insert invalid JSON | `POST /api/v3/data/:baseId/:tableId/records` | Invalid JSON string | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 107 | Records | Insert duplicate user ID | `POST /api/v3/data/:baseId/:tableId/records` | Duplicate user in multi-user field | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 108 | Records | Insert non-existent user | `POST /api/v3/data/:baseId/:tableId/records` | Non-existent user ID | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 109 | Links (LTAR) | HM insert with links | `POST /api/v3/data/:baseId/:tableId/records` | Insert with link IDs in LTAR field | 200 | N |  |
| 110 | Links (LTAR) | BT/MM insert variants | `POST /api/v3/data/:baseId/:tableId/records` | Various BT/MM insert patterns | 200 | N |  |
| 111 | Attachment | Upload file | `POST /api/v3/data/:baseId/:tableId/records` | Upload attachment to record | 200 | N |  |
| 112 | Attachment | URL attachment | `POST /api/v3/data/:baseId/:tableId/records` | Attach via URL | 200 | N |  |
| 113 | Attachment | Cell limit exceeded | `POST /api/v3/data/:baseId/:tableId/records` | Exceed max attachments per cell | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 114 | Unique Constraint | Insert duplicate | `POST /api/v3/data/:baseId/:tableId/records` | Insert duplicate unique value | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 115 | Records | Update (all fields) | `PATCH /api/v3/data/:baseId/:tableId/records` | Update all text fields | 200 | N |  |
| 116 | Records | Update (partial) | `PATCH /api/v3/data/:baseId/:tableId/records` | Update 2 fields only | 200 | N |  |
| 117 | Records | Update (bulk) | `PATCH /api/v3/data/:baseId/:tableId/records` | Bulk update 2 records | 200 | N |  |
| 118 | Records | Update (column id) | `PATCH /api/v3/data/:baseId/:tableId/records` | Update using column IDs | 200 | N |  |
| 119 | Records | Update (bulk column id) | `PATCH /api/v3/data/:baseId/:tableId/records` | Bulk update using column IDs | 200 | N |  |
| 120 | Records | Update (invalid row) | `PATCH /api/v3/data/:baseId/:tableId/records` | Non-existent row ID | 404 | Y | ERR_RECORD_NOT_FOUND |
| 121 | Records | Update length > 100k | `PATCH /api/v3/data/:baseId/:tableId/records` | Value exceeds max 100k length | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 122 | Records | Update record not found | `PATCH /api/v3/data/:baseId/:tableId/records` | Non-existent record on update | 404 | Y |ERR_RECORD_NOT_FOUND |
| 123 | Records | Missing id on update | `PATCH /api/v3/data/:baseId/:tableId/records` | Missing required `id` property | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 124 | Records | Update empty array | `PATCH /api/v3/data/:baseId/:tableId/records` | Zero records (no-op) | 200 | Y | (no-op, returns 200) |
| 125 | Records | Update invalid number | `PATCH /api/v3/data/:baseId/:tableId/records` | String for Number field | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 126 | Records | Update invalid PK format | `PATCH /api/v3/data/:baseId/:tableId/records` | Text PK for numeric column | 422 | Y | ERR_INVALID_PK_VALUE |
| 127 | Records | Extra body props on update | `PATCH /api/v3/data/:baseId/:tableId/records` | Properties outside `fields` on update | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 128 | Links (LTAR) | HM update with links | `PATCH /api/v3/data/:baseId/:tableId/records` | Update with LTAR links | 200 | N |  |
| 129 | Unique Constraint | Update to duplicate | `PATCH /api/v3/data/:baseId/:tableId/records` | Update to duplicate value | 422 | Y | ERR_INVALID_VALUE_FOR_FIELD |
| 130 | Records | Delete (single) | `DELETE /api/v3/data/:baseId/:tableId/records` | Delete body `{id:1}` | 200 | N |  |
| 131 | Records | Delete (bulk) | `DELETE /api/v3/data/:baseId/:tableId/records` | Delete body `[{id:1},{id:2}]` | 200 | N |  |
| 132 | Records | Delete (invalid row) | `DELETE /api/v3/data/:baseId/:tableId/records` | Non-existent row ID | 404 | Y | ERR_RECORD_NOT_FOUND |
| 133 | Records | Delete record not found | `DELETE /api/v3/data/:baseId/:tableId/records` | Non-existent record on delete | 404 | Y |ERR_RECORD_NOT_FOUND |
| 134 | Records | Delete invalid PK format | `DELETE /api/v3/data/:baseId/:tableId/records` | Text PK for numeric column | 422 | Y | ERR_INVALID_PK_VALUE |
| 135 | Records | Missing id on delete | `DELETE /api/v3/data/:baseId/:tableId/records` | Missing required `id` property | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 136 | Records | Number CRUD lifecycle | `GET+POST+PATCH+DEL /api/v3/data/:baseId/:tableId/records` | Full lifecycle: Number,Decimal,Currency,Percent,Duration,Rating | 200 | N |  |
| 137 | Records | Select CRUD lifecycle | `GET+POST+PATCH+DEL /api/v3/data/:baseId/:tableId/records` | Full lifecycle: SingleSelect, MultiSelect (arrays in V3) | 200 | N |  |
| 138 | Records | Date CRUD lifecycle | `GET+POST+PATCH+DEL /api/v3/data/:baseId/:tableId/records` | Full lifecycle: Date, DateTime | 200 | N |  |
| 139 | Records | Checkbox insert (single) | `POST+GET+PATCH /api/v3/data/:baseId/:tableId/records` | true/false/"true"/"Y"/1/0 etc. | 200 | N |  |
| 140 | Records | Checkbox insert (bulk) | `POST+PATCH /api/v3/data/:baseId/:tableId/records` | Bulk checkbox with various formats | 200 | N |  |
| 141 | Records | Read (all fields) | `GET /api/v3/data/:baseId/:tableId/records/1` | Read record with all fields | 200 | N |  |
| 142 | Records | Record not found | `GET /api/v3/data/:baseId/:tableId/records/1032` | Non-existent record ID | 404 | Y | ERR_RECORD_NOT_FOUND |
| 143 | Records | Read (specific field) | `GET /api/v3/data/:baseId/:tableId/records/1?fields=Country` | Single field only | 200 | N |  |
| 144 | Records | Read (field + PK) | `GET /api/v3/data/:baseId/:tableId/records/1?fields=id,Country` | PK + field | 200 | N |  |
| 145 | Records | Read (nested LTAR) | `GET /api/v3/data/:baseId/:tableId/records/2` | Read record with link count | 200 | N |  |
| 146 | Records | Read (nested Lookup) | `GET /api/v3/data/:baseId/:tableId/records/2` | Read with Lookup column | 200 | N |  |
| 147 | Records | Read (nested Rollup) | `GET /api/v3/data/:baseId/:tableId/records/2` | Read with Rollup column | 200 | N |  |
| 148 | Records | Read (invalid ID) | `GET /api/v3/data/:baseId/:tableId/records/9999` | Non-existent record | 404 | Y |ERR_RECORD_NOT_FOUND |
| 149 | Links (LTAR) | BT read as object | `GET /api/v3/data/:baseId/:tableId/records/:id?linksAsLtar=true` | BT returns nested object | 200 | N |  |
| 150 | Records | Invalid PK type (number col) | `GET /api/v3/data/:baseId/:tableId/records/text-primary-key` | Text PK for numeric column | 422 | Y | ERR_INVALID_PK_VALUE |
| 151 | Records | Invalid PK type (ID col) | `GET /api/v3/data/:baseId/:tableId/records/text-primary-key` | Text PK for ID column | 422 | Y | ERR_INVALID_PK_VALUE |
| 152 | Records | List (single field) | `GET /api/v3/data/:baseId/:tableId/records?fields=Country` | List with 1 field selected | 200 | N |  |
| 153 | Records | Invalid select field | `GET /api/v3/data/:baseId/:tableId/records?fields=NotFound` | Non-existent field in select | 422 | Y | ERR_FIELD_NOT_FOUND |
| 154 | Records | List (single field text) | `GET /api/v3/data/:baseId/:tableId/records?fields=SingleLineText` | Single field filter | 200 | N |  |
| 155 | Records | List (JSON string fields) | `GET /api/v3/data/:baseId/:tableId/records?fields=["id","Country"]` | Fields as JSON string | 200 | N |  |
| 156 | Records | List (field + PK) | `GET /api/v3/data/:baseId/:tableId/records?fields=id,Country` | List with PK + field | 200 | N |  |
| 157 | Records | List (multi fields) | `GET /api/v3/data/:baseId/:tableId/records?fields[]=SingleLineText&fields[]=MultiLineText` | Multiple field filter | 200 | N |  |
| 158 | Records | List (array fields) | `GET /api/v3/data/:baseId/:tableId/records?fields[]=id&fields[]=Country` | Fields as repeated query params | 200 | N |  |
| 159 | Records | List (filter like) | `GET /api/v3/data/:baseId/:tableId/records?filter=(Country,like,Ind)` | Filter with like operator | 200 | N |  |
| 160 | Records | Date group-by eq | `GET /api/v3/data/:baseId/:tableId/records?filter=(DateTime,gb_eq,exactDate,"...")` | Group-by date filter | 200 | N |  |
| 161 | Records | List (invalid limit) | `GET /api/v3/data/:baseId/:tableId/records?limit=-100` | Negative limit falls back to default | 200 | Y | (falls back to default) |
| 162 | Records | List (nested LTAR) | `GET /api/v3/data/:baseId/:tableId/records?limit=10` | List with link-to-another-record count | 200 | N |  |
| 163 | Records | List (nested Lookup) | `GET /api/v3/data/:baseId/:tableId/records?limit=10` | List with Lookup column | 200 | N |  |
| 164 | Records | List (nested Rollup) | `GET /api/v3/data/:baseId/:tableId/records?limit=10` | List with Rollup column | 200 | N |  |
| 165 | Records | List (pagination) | `GET /api/v3/data/:baseId/:tableId/records?limit=4` | List records with limit 4, then page 2 | 200 | N |  |
| 166 | Links (LTAR) | HM list as objects | `GET /api/v3/data/:baseId/:tableId/records?linksAsLtar=true` | HM returns nested objects not count | 200 | N |  |
| 167 | Links (LTAR) | MM list as objects | `GET /api/v3/data/:baseId/:tableId/records?linksAsLtar=true` | MM returns nested objects | 200 | N |  |
| 168 | Links (LTAR) | Cache correctness | `GET /api/v3/data/:baseId/:tableId/records?linksAsLtar=true` | No stale data after link changes | 200 | N |  |
| 169 | Records | List (invalid offset) | `GET /api/v3/data/:baseId/:tableId/records?offset=10000` | Offset > total rows | 422 | Y | (message only) |
| 170 | Records | List (offset, limit) | `GET /api/v3/data/:baseId/:tableId/records?offset=200&limit=100` | Offset + limit pagination | 200 | N |  |
| 171 | Records | Invalid page (negative) | `GET /api/v3/data/:baseId/:tableId/records?page=-1` | Negative page | 422 | Y | (message only) |
| 172 | Records | Invalid page (large) | `GET /api/v3/data/:baseId/:tableId/records?page=500` | Page exceeds data | 422 | Y | (message only) |
| 173 | Records | Invalid page (string) | `GET /api/v3/data/:baseId/:tableId/records?page=hello` | Non-numeric page | 422 | Y | (message only) |
| 174 | Records | List (number sort+filter) | `GET /api/v3/data/:baseId/:tableId/records?sort=[...]&where=(...)&fields=[...]` | Number table with combined params | 200 | N |  |
| 175 | Records | List (sort asc) | `GET /api/v3/data/:baseId/:tableId/records?sort=[{"direction":"asc","field":"SingleLineText"}]` | Ascending sort | 200 | N |  |
| 176 | Records | List (sort desc) | `GET /api/v3/data/:baseId/:tableId/records?sort=[{"direction":"desc","field":"SingleLineText"}]` | Descending sort | 200 | N |  |
| 177 | Records | Invalid sort field | `GET /api/v3/data/:baseId/:tableId/records?sort=[{"field":"NotFound"}]` | Sort by non-existent field | 422 | Y | ERR_FIELD_NOT_FOUND |
| 178 | Records | List (invalid sort/filter/fields) | `GET /api/v3/data/:baseId/:tableId/records?sort=[{"field":"abc"}]` | Invalid field names in params | 422 | Y | ERR_FIELD_NOT_FOUND |
| 179 | Records | List (sort multi) | `GET /api/v3/data/:baseId/:tableId/records?sort=[{...},{...}]` | Multi-column sort | 200 | N |  |
| 180 | Records | List (invalid viewId) | `GET /api/v3/data/:baseId/:tableId/records?viewId=123456789` | Invalid view ID | 422 | Y | ERR_VIEW_NOT_FOUND |
| 181 | Records | Invalid viewId param | `GET /api/v3/data/:baseId/:tableId/records?viewId=123456890` | Non-existent view | 422 | Y | ERR_VIEW_NOT_FOUND |
| 182 | Records | List (viewId) | `GET /api/v3/data/:baseId/:tableId/records?viewId=:viewId` | List with view filters/sorts/fields | 200 | N |  |
| 183 | Records | Date filter eq exactDate IST | `GET /api/v3/data/:baseId/:tableId/records?viewId=:viewId` | View filter: Date eq exactDate Asia/Kolkata | 200 | N |  |
| 184 | Records | Date filter gte exactDate IST | `GET /api/v3/data/:baseId/:tableId/records?viewId=:viewId` | View filter: Date >= exactDate Asia/Kolkata | 200 | N |  |
| 185 | Records | List (viewId + fields) | `GET /api/v3/data/:baseId/:tableId/records?viewId=:viewId&fields=[...]` | View + field selection | 200 | N |  |
| 186 | Records | List (viewId + sort) | `GET /api/v3/data/:baseId/:tableId/records?viewId=:viewId&sort=[...]` | View + additional sort | 200 | N |  |
| 187 | Records | List (viewId + filter) | `GET /api/v3/data/:baseId/:tableId/records?viewId=:viewId&where=(...)` | View + additional filter | 200 | N |  |
| 188 | Records | List (filter multi) | `GET /api/v3/data/:baseId/:tableId/records?where=(A,eq,X)~and(B,eq,Y)` | Multiple filters with AND | 200 | N |  |
| 189 | Records | Invalid filter value | `GET /api/v3/data/:baseId/:tableId/records?where=(Area,eq,HELLO)` | Wrong type for filter value | 422 | Y | ERR_FILTER_VERIFICATION_FAILED |
| 190 | Records | Invalid filter operator | `GET /api/v3/data/:baseId/:tableId/records?where=(Area,notInOp,X)` | Unknown operator | 422 | Y | ERR_INVALID_FILTER |
| 191 | Records | Invalid filter missing comma | `GET /api/v3/data/:baseId/:tableId/records?where=(Field` | Missing comma in filter | 422 | Y | ERR_INVALID_FILTER |
| 192 | Records | Invalid filter syntax | `GET /api/v3/data/:baseId/:tableId/records?where=(Field,eq` | Malformed filter (missing paren) | 422 | Y | ERR_INVALID_FILTER |
| 193 | Records | Invalid filter field | `GET /api/v3/data/:baseId/:tableId/records?where=(NotFound,eq,1)` | Filter non-existent field | 422 | Y | ERR_FIELD_NOT_FOUND |
| 194 | Records | List (filter single) | `GET /api/v3/data/:baseId/:tableId/records?where=(SingleLineText,eq,Afghanistan)` | Single filter | 200 | N |  |
| 195 | Filters (Meta) | Update | `PATCH /api/v3/meta/.../views/:viewId/filters/:filterId` | Update filter | 200 | N |  |
| 196 | Filters (Meta) | Delete | `DELETE /api/v3/meta/.../views/:viewId/filters/:filterId` | Delete filter | 200 | N |  |
| 197 | Sorts (Meta) | Update | `PATCH /api/v3/meta/.../views/:viewId/sorts/:sortId` | Update sort | 200 | N |  |
| 198 | Sorts (Meta) | Delete | `DELETE /api/v3/meta/.../views/:viewId/sorts/:sortId` | Delete sort | 200 | N |  |
| 199 | Base | Read | `GET /api/v3/meta/bases/:baseId` | Get single base | 200 | N |  |
| 200 | Base | Update | `PATCH /api/v3/meta/bases/:baseId` | Update base properties | 200 | N |  |
| 201 | Base | Delete | `DELETE /api/v3/meta/bases/:baseId` | Delete base | 200 | N |  |
| 202 | Unique Constraint | Enable constraint | `PATCH /api/v3/meta/bases/:baseId/fields/:fieldId` | Enable unique on existing | 200 | N |  |
| 203 | Unique Constraint | Disable constraint | `PATCH /api/v3/meta/bases/:baseId/fields/:fieldId` | Disable unique | 200 | N |  |
| 204 | Field | Get not found | `GET /api/v3/meta/bases/:baseId/fields/invalid` | Non-existent field | 404 | Y | ERR_FIELD_NOT_FOUND |
| 205 | Field | Update not found | `PATCH /api/v3/meta/bases/:baseId/fields/invalid` | Non-existent field | 404 | Y | ERR_FIELD_NOT_FOUND |
| 206 | Field | Delete not found | `DELETE /api/v3/meta/bases/:baseId/fields/invalid` | Non-existent field | 404 | Y | ERR_FIELD_NOT_FOUND |
| 207 | Base Teams | List | `GET /api/v3/meta/bases/:baseId/invites` | List base team invites | 200 | N |  |
| 208 | Base Teams | Add | `POST /api/v3/meta/bases/:baseId/invites` | Add team to base | 200 | N |  |
| 209 | Base Teams | Add duplicate | `POST /api/v3/meta/bases/:baseId/invites` | Add same team twice | 422 | Y | ERR_FORBIDDEN |
| 210 | Base Teams | Get | `GET /api/v3/meta/bases/:baseId/invites/:inviteId` | Get team invite | 200 | N |  |
| 211 | Base Teams | Update | `PATCH /api/v3/meta/bases/:baseId/invites/:inviteId` | Update team role | 200 | N |  |
| 212 | Base Teams | Remove | `DELETE /api/v3/meta/bases/:baseId/invites/:inviteId` | Remove team from base | 200 | N |  |
| 213 | Base Users | Invite (email single) | `POST /api/v3/meta/bases/:baseId/members` | Invite one by email | 200 | N |  |
| 214 | Base Users | Invite (email multi) | `POST /api/v3/meta/bases/:baseId/members` | Invite multiple | 200 | N |  |
| 215 | Base Users | Invite (missing role) | `POST /api/v3/meta/bases/:baseId/members` | Missing base_role | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 216 | Base Users | Invite (missing email) | `POST /api/v3/meta/bases/:baseId/members` | Missing email/user_id | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 217 | Base Users | Invite (by user ID) | `POST /api/v3/meta/bases/:baseId/members` | Invite by user_id | 200 | N |  |
| 218 | Base Users | Update | `PATCH /api/v3/meta/bases/:baseId/members` | Update member role | 200 | N |  |
| 219 | Base Users | Delete | `DELETE /api/v3/meta/bases/:baseId/members` | Delete member | 200 | N |  |
| 220 | Scripts | List | `GET /api/v3/meta/bases/:baseId/scripts` | List all scripts | 200 | N |  |
| 221 | Scripts | Feature flag disabled | `GET /api/v3/meta/bases/:baseId/scripts` | Disabled feature flag | 403 | Y | ERR_FEATURE_NOT_SUPPORTED |
| 222 | Scripts | Create | `POST /api/v3/meta/bases/:baseId/scripts` | Create script | 200 | N |  |
| 223 | Scripts | Read | `GET /api/v3/meta/bases/:baseId/scripts/:scriptId` | Get single script | 200 | N |  |
| 224 | Scripts | Update | `PATCH /api/v3/meta/bases/:baseId/scripts/:scriptId` | Update script | 200 | N |  |
| 225 | Scripts | Delete | `DELETE /api/v3/meta/bases/:baseId/scripts/:scriptId` | Delete script | 200 | N |  |
| 226 | Table | List | `GET /api/v3/meta/bases/:baseId/tables` | List all tables in base | 200 | N |  |
| 227 | Table | Create (email validation) | `POST /api/v3/meta/bases/:baseId/tables` | Table with email field validation=true | 200 | N |  |
| 228 | Table | Create (number default) | `POST /api/v3/meta/bases/:baseId/tables` | Table with number field default value | 200 | N |  |
| 229 | Table | Create missing title | `POST /api/v3/meta/bases/:baseId/tables` | Missing required title | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 230 | Table | Create duplicate title | `POST /api/v3/meta/bases/:baseId/tables` | Duplicate table title | 422 | Y | ERR_DUPLICATE_IN_ALIAS |
| 231 | Table | Create too many fields | `POST /api/v3/meta/bases/:baseId/tables` | Exceeds max field count | 422 | Y | ERR_INVALID_REQUEST_BODY |
| 232 | Unique Constraint | Create table with constraint | `POST /api/v3/meta/bases/:baseId/tables` | Table with unique fields | 200 | N |  |
| 233 | Table | Get | `GET /api/v3/meta/bases/:baseId/tables/:tableId` | Get single table with fields | 200 | N |  |
| 234 | Table | Delete | `DELETE /api/v3/meta/bases/:baseId/tables/:tableId` | Delete table | 200 | N |  |
| 235 | Field | Create SingleLineText | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 236 | Field | Create LongText | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 237 | Field | Create PhoneNumber | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 238 | Field | Create URL | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 239 | Field | Create Email | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 240 | Field | Create Number | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 241 | Field | Create Decimal | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 242 | Field | Create Currency | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 243 | Field | Create Percent | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 244 | Field | Create Duration | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 245 | Field | Create Date | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 246 | Field | Create DateTime | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 247 | Field | Create Time | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 248 | Field | Create SingleSelect | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create with choices + verify | 200 | N |  |
| 249 | Field | Create MultiSelect | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create with choices + verify | 200 | N |  |
| 250 | Field | Create Rating | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 251 | Field | Create Checkbox | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 252 | Field | Create Geometry | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 253 | Field | Create Year | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 254 | Field | Create User | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 255 | Field | Create JSON | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Create + verify via GET | 200 | N |  |
| 256 | Field | Create missing title | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Missing required title | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 257 | Field | Create missing type | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Missing required type | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 258 | Field | Create duplicate title | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Duplicate field title | 422 | Y | ERR_DUPLICATE_IN_ALIAS |
| 259 | Unique Constraint | Create column with constraint | `POST /api/v3/meta/bases/:baseId/tables/:tableId/fields` | Add unique field | 200 | N |  |
| 260 | View | List | `GET /api/v3/meta/bases/:baseId/tables/:tableId/views` | List all views for table | 200 | N |  |
| 261 | View | Feature gate (V3 API) | `GET /api/v3/meta/bases/:baseId/tables/:tableId/views` | Feature flag disabled | 403 | Y | ERR_FEATURE_NOT_SUPPORTED |
| 262 | View | Create Grid | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views` | Create grid view | 200 | N |  |
| 263 | View | Create Kanban | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views` | Create kanban view with grouping | 200 | N |  |
| 264 | View | Create Gallery | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views` | Create gallery view | 200 | N |  |
| 265 | View | Create Calendar | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views` | Create calendar view with date range | 200 | N |  |
| 266 | View | Create missing title | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views` | Missing required title | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 267 | View | Create missing type | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views` | Missing required type | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 268 | View | Create duplicate title | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views` | Duplicate view title | 422 | Y | ERR_INVALID_REQUEST_BODY |
| 269 | View | Get | `GET /api/v3/meta/bases/:baseId/tables/:tableId/views/:viewId` | Get single view | 200 | N |  |
| 270 | View | Update | `PATCH /api/v3/meta/bases/:baseId/tables/:tableId/views/:viewId` | Update view title | 200 | N |  |
| 271 | View | Delete | `DELETE /api/v3/meta/bases/:baseId/tables/:tableId/views/:viewId` | Delete view | 200 | N |  |
| 272 | Filters (Meta) | List | `GET /api/v3/meta/bases/:baseId/tables/:tableId/views/:viewId/filters` | List view filters | 200 | N |  |
| 273 | Filters (Meta) | Create | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views/:viewId/filters` | Create filter | 200 | N |  |
| 274 | Filters (Meta) | Replace | `PUT /api/v3/meta/bases/:baseId/tables/:tableId/views/:viewId/filters` | Replace all filters | 200 | N |  |
| 275 | Sorts (Meta) | List | `GET /api/v3/meta/bases/:baseId/tables/:tableId/views/:viewId/sorts` | List view sorts | 200 | N |  |
| 276 | Sorts (Meta) | Create | `POST /api/v3/meta/bases/:baseId/tables/:tableId/views/:viewId/sorts` | Create sort | 200 | N |  |
| 277 | View | Get not found | `GET /api/v3/meta/bases/:baseId/tables/:tableId/views/invalid` | Non-existent view | 404 | Y |ERR_VIEW_NOT_FOUND |
| 278 | View | Update not found | `PATCH /api/v3/meta/bases/:baseId/tables/:tableId/views/invalid` | Non-existent view | 404 | Y |ERR_VIEW_NOT_FOUND |
| 279 | View | Delete not found | `DELETE /api/v3/meta/bases/:baseId/tables/:tableId/views/invalid` | Non-existent view | 404 | Y |ERR_VIEW_NOT_FOUND |
| 280 | Table | Get not found | `GET /api/v3/meta/bases/:baseId/tables/invalid` | Non-existent table | 404 | Y | ERR_TABLE_NOT_FOUND |
| 281 | Table | Delete not found | `DELETE /api/v3/meta/bases/:baseId/tables/invalid` | Non-existent table | 404 | Y | ERR_TABLE_NOT_FOUND |
| 282 | Base Users | List | `GET /api/v3/meta/bases/:baseId?include[]=members` | List base members | 200 | N |  |
| 283 | Base Users | Forbidden (plan gate) | `GET /api/v3/meta/bases/:baseId?include[]=members` | Feature gate check | 402 | Y | ERR_FEATURE_NOT_SUPPORTED |
| 284 | Base | Get not found | `GET /api/v3/meta/bases/invalid` | Non-existent base | 404 | Y | ERR_BASE_NOT_FOUND |
| 285 | Base | Update not found | `PATCH /api/v3/meta/bases/invalid` | Non-existent base | 404 | Y | ERR_BASE_NOT_FOUND |
| 286 | Base | Delete not found | `DELETE /api/v3/meta/bases/invalid` | Non-existent base | 404 | Y | ERR_BASE_NOT_FOUND |
| 287 | Table | Create invalid base | `POST /api/v3/meta/bases/invalid/tables` | Non-existent base | 422 | Y | ERR_BASE_NOT_FOUND |
| 288 | Field | Create invalid table | `POST /api/v3/meta/bases/invalid/tables/invalid/fields` | Non-existent table | 422 | Y | ERR_TABLE_NOT_FOUND |
| 289 | View | Create invalid table | `POST /api/v3/meta/bases/invalid/tables/invalid/views` | Non-existent table | 422 | Y | ERR_TABLE_NOT_FOUND |
| 290 | API Tokens | List (empty) | `GET /api/v3/meta/tokens` | List tokens when none exist | 200 | N |  |
| 291 | Workspace | List | `GET /api/v3/meta/workspaces` | List all workspaces | 200 | N |  |
| 292 | Workspace | Create | `POST /api/v3/meta/workspaces` | Create workspace with title | 201 | N |  |
| 293 | Workspace | Read | `GET /api/v3/meta/workspaces/:wsId` | Get single workspace | 200 | N |  |
| 294 | WS Users | Read (basic) | `GET /api/v3/meta/workspaces/:wsId` | Read without include | 200 | N |  |
| 295 | Workspace | Update | `PATCH /api/v3/meta/workspaces/:wsId` | Update workspace title | 200 | N |  |
| 296 | Workspace | Delete | `DELETE /api/v3/meta/workspaces/:wsId` | Delete workspace | 200 | N |  |
| 297 | Base | List | `GET /api/v3/meta/workspaces/:wsId/bases` | List all bases in workspace | 200 | N |  |
| 298 | Base | Create | `POST /api/v3/meta/workspaces/:wsId/bases` | Create base with all props | 200 | N |  |
| 299 | Base | Create (minimal) | `POST /api/v3/meta/workspaces/:wsId/bases` | Create with only required fields | 200 | N |  |
| 300 | Base | Create missing title | `POST /api/v3/meta/workspaces/:wsId/bases` | Missing required title | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 301 | Base | Create duplicate title | `POST /api/v3/meta/workspaces/:wsId/bases` | Duplicate base title | 422 | Y | ERR_INVALID_REQUEST_BODY |
| 302 | WS Teams | List | `GET /api/v3/meta/workspaces/:wsId/invites` | List workspace team invites | 200 | N |  |
| 303 | WS Teams | Add | `POST /api/v3/meta/workspaces/:wsId/invites` | Add team to workspace | 200 | N |  |
| 304 | WS Teams | Add duplicate | `POST /api/v3/meta/workspaces/:wsId/invites` | Add same team twice | 422 | Y | ERR_FORBIDDEN |
| 305 | WS Teams | Invalid role | `POST /api/v3/meta/workspaces/:wsId/invites` | Invalid role value | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 306 | WS Teams | Get | `GET /api/v3/meta/workspaces/:wsId/invites/:inviteId` | Get team invite | 200 | N |  |
| 307 | WS Teams | Update | `PATCH /api/v3/meta/workspaces/:wsId/invites/:inviteId` | Update team role | 200 | N |  |
| 308 | WS Teams | Remove | `DELETE /api/v3/meta/workspaces/:wsId/invites/:inviteId` | Remove team from workspace | 200 | N |  |
| 309 | WS Users | Invite (email single) | `POST /api/v3/meta/workspaces/:wsId/members` | Invite one by email | 200 | N |  |
| 310 | WS Users | Invite (email multi) | `POST /api/v3/meta/workspaces/:wsId/members` | Invite multiple by email | 200 | N |  |
| 311 | WS Users | Invite (missing role) | `POST /api/v3/meta/workspaces/:wsId/members` | Missing workspace_role | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 312 | WS Users | Invite (missing email) | `POST /api/v3/meta/workspaces/:wsId/members` | Missing email/user_id | 400 | Y | ERR_INVALID_REQUEST_BODY |
| 313 | WS Users | Invite (by user ID) | `POST /api/v3/meta/workspaces/:wsId/members` | Invite by user_id | 200 | N |  |
| 314 | WS Users | Update (single) | `PATCH /api/v3/meta/workspaces/:wsId/members` | Update member role | 200 | N |  |
| 315 | WS Users | Update (bulk) | `PATCH /api/v3/meta/workspaces/:wsId/members` | Bulk update roles | 200 | N |  |
| 316 | WS Users | Delete (single) | `DELETE /api/v3/meta/workspaces/:wsId/members` | Delete one member | 200 | N |  |
| 317 | WS Users | Delete (bulk) | `DELETE /api/v3/meta/workspaces/:wsId/members` | Bulk delete members | 200 | N |  |
| 318 | Teams | List | `GET /api/v3/meta/workspaces/:wsId/teams` | List all teams | 200 | N |  |
| 319 | Teams | Create | `POST /api/v3/meta/workspaces/:wsId/teams` | Create team | 200 | N |  |
| 320 | Teams | Get | `GET /api/v3/meta/workspaces/:wsId/teams/:teamId` | Get single team | 200 | N |  |
| 321 | Teams | Update | `PATCH /api/v3/meta/workspaces/:wsId/teams/:teamId` | Update team | 200 | N |  |
| 322 | Teams | Delete | `DELETE /api/v3/meta/workspaces/:wsId/teams/:teamId` | Delete team | 200 | N |  |
| 323 | Teams | List members | `GET /api/v3/meta/workspaces/:wsId/teams/:teamId/members` | List team members | 200 | N |  |
| 324 | Teams | Add member | `POST /api/v3/meta/workspaces/:wsId/teams/:teamId/members` | Add member to team | 200 | N |  |
| 325 | Teams | Update member role | `PATCH /api/v3/meta/workspaces/:wsId/teams/:teamId/members` | Update team member role | 200 | N |  |
| 326 | Teams | Remove member | `DELETE /api/v3/meta/workspaces/:wsId/teams/:teamId/members` | Remove member from team | 200 | N |  |
| 327 | WS Users | Read (invalid include) | `GET /api/v3/meta/workspaces/:wsId?include=invalid` | Invalid include param (ignored) | 200 | Y | (ignored, returns 200) |
| 328 | WS Users | List members | `GET /api/v3/meta/workspaces/:wsId?include=members` | List workspace members | 200 | N |  |
| 329 | WS Users | Read (with members) | `GET /api/v3/meta/workspaces/:wsId?include=members` | Read with members include | 200 | N |  |
| 330 | WS Users | Read (include array) | `GET /api/v3/meta/workspaces/:wsId?include[]=members` | Array format include | 200 | N |  |
| 331 | Base | Create invalid workspace | `POST /api/v3/meta/workspaces/invalid/bases` | Non-existent workspace | 422 | Y | ERR_WORKSPACE_NOT_FOUND |
| 332 | Records | URL path not found | `GET /api/v3/mybase/mytable/unknown-path/1234` | Non-existent route | 404 | Y | NOT_FOUND |
| 333 | Records | Invalid API version | `GET /api/v4/1234567890/2134567890` | Unsupported API version | 404 | Y | INVALID_API_VERSION |
