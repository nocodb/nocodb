# Meta Tables Reference

## Overview

NocoDB stores its own metadata (bases, tables, columns, views, etc.) in dedicated meta tables. These are defined in the `MetaTable` enum and accessed via the `ncMeta` API.

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/utils/globals.ts`

## Core Meta Tables

### Bases & Sources

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.PROJECT` | `nc_bases_v2` | Projects/bases (previously called projects) |
| `MetaTable.SOURCES` | `nc_sources_v2` | Data sources within bases |
| `MetaTable.BASES` | `nc_bases_v2` | Alias for PROJECT |

### Tables & Columns

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.MODELS` | `nc_models_v2` | Tables/models metadata |
| `MetaTable.COLUMNS` | `nc_columns_v2` | Column definitions |
| `MetaTable.COL_BARCODE` | `nc_col_barcode_v2` | Barcode column config |
| `MetaTable.COL_QRCODE` | `nc_col_qrcode_v2` | QR code column config |
| `MetaTable.COL_LOOKUP` | `nc_col_lookup_v2` | Lookup column config |
| `MetaTable.COL_ROLLUP` | `nc_col_rollup_v2` | Rollup column config |
| `MetaTable.COL_FORMULA` | `nc_col_formula_v2` | Formula column config |
| `MetaTable.COL_RELATIONS` | `nc_col_relations_v2` | Relation/link column config |
| `MetaTable.COL_SELECT_OPTIONS` | `nc_col_select_options_v2` | Single/multi-select options |
| `MetaTable.COL_BUTTON` | `nc_col_button_v2` | Button column config |

### Views

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.GRID_VIEW` | `nc_grid_view_v2` | Grid/table view config |
| `MetaTable.GRID_VIEW_COLUMNS` | `nc_grid_view_columns_v2` | Grid column visibility/order |
| `MetaTable.FORM_VIEW` | `nc_form_view_v2` | Form view config |
| `MetaTable.FORM_VIEW_COLUMNS` | `nc_form_view_columns_v2` | Form field visibility/order |
| `MetaTable.GALLERY_VIEW` | `nc_gallery_view_v2` | Gallery view config |
| `MetaTable.GALLERY_VIEW_COLUMNS` | `nc_gallery_view_columns_v2` | Gallery column config |
| `MetaTable.KANBAN_VIEW` | `nc_kanban_view_v2` | Kanban view config |
| `MetaTable.KANBAN_VIEW_COLUMNS` | `nc_kanban_view_columns_v2` | Kanban column config |
| `MetaTable.CALENDAR_VIEW` | `nc_calendar_view_v2` | Calendar view config |
| `MetaTable.CALENDAR_VIEW_COLUMNS` | `nc_calendar_view_columns_v2` | Calendar column config |
| `MetaTable.CALENDAR_VIEW_RANGE` | `nc_calendar_view_range_v2` | Calendar date range config |
| `MetaTable.MAP_VIEW` | `nc_map_view_v2` | Map view config |
| `MetaTable.MAP_VIEW_COLUMNS` | `nc_map_view_columns_v2` | Map column config |

### Filters, Sorts & Grouping

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.FILTER_EXP` | `nc_filter_exp_v2` | Filter expressions |
| `MetaTable.SORT` | `nc_sort_v2` | Sort configurations |
| `MetaTable.COL_GROUPS` | `nc_col_groups` | Column grouping |

## Users & Auth

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.USERS` | `nc_users_v2` | User accounts |
| `MetaTable.ORGS_OLD` | `nc_orgs_v2` | Organizations (legacy) |
| `MetaTable.ORGS` | `nc_orgs` | Organizations (current) |
| `MetaTable.TEAMS` | `nc_teams` | Teams |
| `MetaTable.ORG_USERS` | `nc_org_users` | Organization user memberships |
| `MetaTable.PROJECT_USERS` | `nc_project_users_v2` | Base user roles |
| `MetaTable.TEAM_USERS` | `nc_team_users` | Team user memberships |

## Workspaces & Collaboration

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.WORKSPACES` | `nc_workspaces` | Workspaces |
| `MetaTable.WORKSPACE_USERS` | `nc_workspace_users` | Workspace user roles |
| `MetaTable.WORKSPACE_INTEGRATIONS` | `nc_workspace_integrations` | Workspace integrations |

## Webhooks & Automations

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.HOOKS` | `nc_hooks` | Webhooks/hooks |
| `MetaTable.HOOK_FILTERS` | `nc_hook_filters_v2` | Webhook filter conditions |
| `MetaTable.HOOK_LOGS` | `nc_hook_logs_v2` | Webhook execution logs |
| `MetaTable.AUTOMATIONS` | `nc_automations` | Automation rules |
| `MetaTable.WORKFLOWS` | `nc_workflows` | Workflows (EE) |

## API Tokens & Auth

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.API_TOKENS` | `nc_api_tokens` | API tokens |
| `MetaTable.API_TOKENS_V3` | `nc_api_tokens_v3` | V3 API tokens |

## Sharing & Public Access

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.SHARED_VIEWS` | `nc_shared_views` | Publicly shared views |
| `MetaTable.SHARED_BASE` | `nc_shared_bases` | Publicly shared bases |

## Comments & Activity

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.COMMENTS` | `nc_comments` | Comments on records |
| `MetaTable.COMMENTS_REACTIONS` | `nc_comments_reactions` | Comment reactions |
| `MetaTable.AUDIT` | `nc_audit_v2` | Audit trail |

## Attachments & Files

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.ATTACHMENTS` | `nc_attachments_v2` | File attachments |

## Extensions & Integrations

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.EXTENSIONS` | `nc_extensions` | Extensions |
| `MetaTable.BASES_EXTENSIONS` | `nc_bases_extensions` | Extension installations per base |
| `MetaTable.STORE` | `nc_store` | Extension store |
| `MetaTable.INTEGRATIONS` | `nc_integrations` | Integrations |

## Sync & Replication

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.SYNC_SOURCE` | `nc_sync_source_v2` | Sync sources (e.g., Airtable) |
| `MetaTable.SYNC_LOGS` | `nc_sync_logs_v2` | Sync operation logs |

## Notification & Subscriptions

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.NOTIFICATION` | `nc_notification` | Notifications |
| `MetaTable.SUBSCRIPTIONS` | `nc_subscriptions` | Subscription plans (EE) |

## Scripts & Actions (EE)

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.SCRIPTS` | `nc_scripts` | Scripts (EE) |
| `MetaTable.ACTIONS` | `nc_actions` | Actions (EE) |

## OAuth & SSO (EE)

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.SSO_CLIENT` | `nc_sso_client` | SSO client configurations |
| `MetaTable.OAUTH_CLIENT` | `nc_oauth_client` | OAuth clients |
| `MetaTable.OAUTH_TOKEN` | `nc_oauth_token` | OAuth tokens |
| `MetaTable.OAUTH_AUTHORIZATION_CODE` | `nc_oauth_authorization_code` | OAuth authorization codes |

## Permissions & Access Control

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.PERMISSIONS` | `nc_permissions` | Fine-grained permissions |
| `MetaTable.ACLS` | `nc_acl_v2` | Access control lists |

## Billing & Payment (EE)

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.PAYMENT` | `nc_payment` | Payment records |

## Managed Apps (EE)

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.MANAGED_APPS` | `nc_managed_apps` | Managed applications |

## Dashboards & Widgets (EE)

| Enum | Table Name | Purpose |
|------|------------|---------|
| `MetaTable.DASHBOARDS` | `nc_dashboards` | Dashboards |
| `MetaTable.WIDGETS` | `nc_widgets` | Dashboard widgets |

## Meta API Usage

### Reading Meta Tables

```typescript
// Get single record
const base = await Noco.ncMeta.metaGet2(
  RootScopes.ROOT,
  RootScopes.ROOT,
  MetaTable.BASES,
  { id: baseId }
);

// List records
const tables = await Noco.ncMeta.metaList2(
  RootScopes.ROOT,
  baseId,
  MetaTable.MODELS,
  {
    condition: { base_id: baseId },
    orderBy: { order: 'asc' }
  }
);

// Count records
const count = await Noco.ncMeta.metaCount(
  RootScopes.ROOT,
  baseId,
  MetaTable.MODELS
);
```

### Writing Meta Tables

```typescript
// Insert
const result = await Noco.ncMeta.metaInsert2(
  RootScopes.ROOT,
  baseId,
  MetaTable.MODELS,
  {
    title: 'My Table',
    table_name: 'my_table',
    base_id: baseId,
    source_id: sourceId
  }
);

// Update
await Noco.ncMeta.metaUpdate2(
  RootScopes.ROOT,
  baseId,
  MetaTable.MODELS,
  { title: 'Updated Title' },
  { id: tableId }
);

// Delete
await Noco.ncMeta.metaDelete(
  RootScopes.ROOT,
  baseId,
  MetaTable.MODELS,
  { id: tableId }
);
```

### Scopes

```typescript
enum RootScopes {
  ROOT = 'root',
  WORKSPACE = 'ws',
  BASE = 'base',
  SOURCE = 'source',
}
```

## Cache Scopes

Related cache scopes (from `CacheScope` enum):

| Scope | Purpose |
|-------|---------|
| `CacheScope.ROOT` | Root level cache |
| `CacheScope.WORKSPACE` | Workspace level cache |
| `CacheScope.BASE` | Base/project level cache |
| `CacheScope.SOURCE` | Data source level cache |
| `CacheScope.TABLE` | Table level cache |
| `CacheScope.COLUMN` | Column level cache |
| `CacheScope.VIEW` | View level cache |
| `CacheScope.FILTER` | Filter cache |
| `CacheScope.SORT` | Sort cache |
| `CacheScope.GALLERY_VIEW` | Gallery view cache |
| `CacheScope.FORM_VIEW` | Form view cache |
| `CacheScope.KANBAN_VIEW` | Kanban view cache |
| `CacheScope.CALENDAR_VIEW` | Calendar view cache |

## Common Query Patterns

### Finding by Foreign Key

```typescript
// Find all tables in a base
const tables = await Noco.ncMeta.metaList2(
  RootScopes.ROOT,
  baseId,
  MetaTable.MODELS,
  { condition: { base_id: baseId } }
);
```

### Finding with Pagination

```typescript
// Paginated list
const tables = await Noco.ncMeta.metaList2(
  RootScopes.ROOT,
  baseId,
  MetaTable.MODELS,
  {
    condition: { base_id: baseId },
    limit: 25,
    offset: 0,
    orderBy: { created_at: 'desc' }
  }
);
```

### Checking Existence

```typescript
// Check if record exists
const exists = await Noco.ncMeta.metaGet2(
  RootScopes.ROOT,
  baseId,
  MetaTable.MODELS,
  { id: tableId }
);

if (!exists) {
  throw NcError.notFound('Table not found');
}
```

## See Also

- [Backend Architecture](./backend-architecture.md) - How models use meta tables
- [Common Patterns](./common-patterns.md) - Meta table access patterns
- [Key File Locations](./key-file-locations.md) - globals.ts location
