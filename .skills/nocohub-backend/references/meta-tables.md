# MetaTable & CacheScope Reference

Quick reference for database tables and cache scopes. Source: `packages/nocodb/src/utils/globals.ts`

## MetaTable Enum

Database tables for NocoDB metadata storage.

### Core Tables
| Enum Key | Table Name | Description |
|----------|------------|-------------|
| PROJECT | nc_bases_v2 | Base/project definitions |
| SOURCES | nc_sources_v2 | Data source connections |
| MODELS | nc_models_v2 | Table/model definitions |
| COLUMNS | nc_columns_v2 | Column definitions |
| VIEWS | nc_views_v2 | View definitions |
| USERS | nc_users_v2 | User accounts |

### Column Types
| Enum Key | Table Name |
|----------|------------|
| COL_RELATIONS | nc_col_relations_v2 |
| COL_SELECT_OPTIONS | nc_col_select_options_v2 |
| COL_LOOKUP | nc_col_lookup_v2 |
| COL_ROLLUP | nc_col_rollup_v2 |
| COL_FORMULA | nc_col_formula_v2 |
| COL_QRCODE | nc_col_qrcode_v2 |
| COL_BARCODE | nc_col_barcode_v2 |
| COL_LONG_TEXT | nc_col_long_text_v2 |
| COL_BUTTON | nc_col_button_v2 |

### View Types
| Enum Key | Table Name |
|----------|------------|
| GRID_VIEW | nc_grid_view_v2 |
| GRID_VIEW_COLUMNS | nc_grid_view_columns_v2 |
| FORM_VIEW | nc_form_view_v2 |
| FORM_VIEW_COLUMNS | nc_form_view_columns_v2 |
| GALLERY_VIEW | nc_gallery_view_v2 |
| GALLERY_VIEW_COLUMNS | nc_gallery_view_columns_v2 |
| KANBAN_VIEW | nc_kanban_view_v2 |
| KANBAN_VIEW_COLUMNS | nc_kanban_view_columns_v2 |
| CALENDAR_VIEW | nc_calendar_view_v2 |
| CALENDAR_VIEW_COLUMNS | nc_calendar_view_columns_v2 |
| MAP_VIEW | nc_map_view_v2 |
| MAP_VIEW_COLUMNS | nc_map_view_columns_v2 |

### Webhooks & Automation
| Enum Key | Table Name |
|----------|------------|
| HOOKS | nc_hooks_v2 |
| HOOK_LOGS | nc_hook_logs_v2 |
| HOOK_TRIGGER_FIELDS | nc_hook_trigger_fields |
| AUTOMATIONS | nc_automations |
| AUTOMATION_EXECUTIONS | nc_automation_executions |

### Access Control
| Enum Key | Table Name |
|----------|------------|
| PROJECT_USERS | nc_base_users_v2 |
| WORKSPACE | workspace |
| WORKSPACE_USER | workspace_user |
| TEAMS | nc_teams |
| TEAM_USERS | nc_team_users |
| PERMISSIONS | nc_permissions |
| PERMISSION_SUBJECTS | nc_permission_subjects |
| API_TOKENS | nc_api_tokens |

### EE Features
| Enum Key | Table Name |
|----------|------------|
| SSO_CLIENT | nc_sso_client |
| SSO_CLIENT_DOMAIN | nc_sso_client_domain |
| ORG | nc_org |
| ORG_USERS | nc_org_users |
| DASHBOARDS | nc_dashboards_v2 |
| WIDGETS | nc_widgets_v2 |
| OAUTH_CLIENTS | nc_oauth_clients |
| SYNC_CONFIGS | nc_sync_configs |

## CacheScope Enum

Cache key prefixes for Redis/memory cache.

### Common Scopes
```typescript
CacheScope.PROJECT      // 'base'
CacheScope.SOURCE       // 'source'
CacheScope.MODEL        // 'model'
CacheScope.COLUMN       // 'column'
CacheScope.VIEW         // 'view'
CacheScope.USER         // 'user'
CacheScope.API_TOKEN    // 'apiToken'
CacheScope.HOOK         // 'hook'
CacheScope.INTEGRATION  // 'integration'
CacheScope.DASHBOARD    // 'dashboard'
CacheScope.WIDGET       // 'widget'
```

### Cache Key Pattern
```typescript
// Pattern: `${CacheScope.SCOPE}:${id}`
`${CacheScope.MODEL}:${tableId}`     // 'model:tbl_xxx'
`${CacheScope.VIEW}:${viewId}`       // 'view:vw_xxx'
`${CacheScope.API_TOKEN}:${token}`   // 'apiToken:xxx'
```

## Adding New Tables

1. Add to `MetaTable` enum in `src/utils/globals.ts`
2. Add to `CacheScope` if caching is needed
3. Create migration file in `src/meta/migrations/v2/`
4. Update `XcMigrationSourcev2.ts`

## RootScopes

Used for meta operations scope context:
```typescript
export enum RootScopes {
  ROOT = 'root',
  WORKSPACE = 'workspace',
  BASE = 'base',
}
```
