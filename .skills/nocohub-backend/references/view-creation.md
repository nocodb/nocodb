# Creating a New View Type — Meta Layer Reference

This document covers the complete meta layer implementation for adding a new view type to NocoDB, based on the List View implementation. It covers models, migrations, swagger, SDK, services, events, audits, and cache — everything except the data-fetching endpoints.

## Table of Contents

1. [Overview — What a View Type Needs](#overview)
2. [Step 1: SDK Types & Swagger Schema](#step-1-sdk-types--swagger-schema)
3. [Step 2: Migration](#step-2-migration)
4. [Step 3: Globals (CE + EE)](#step-3-globals-ce--ee)
5. [Step 4: Models](#step-4-models)
6. [Step 5: View.ts Integration](#step-5-viewts-integration)
7. [Step 6: Service](#step-6-service)
8. [Step 7: Operations & Module Registration](#step-7-operations--module-registration)
9. [Step 8: App Events & Hooks](#step-8-app-events--hooks)
10. [Step 9: Audit (EE app-hooks-listener)](#step-9-audit-ee-app-hooks-listener)
11. [Checklist](#checklist)

---

## Overview

A view type in NocoDB consists of these meta-layer pieces:

| Piece | Purpose | Example Tables |
|-------|---------|----------------|
| **View table** | View-specific settings (1:1 with `nc_views_v2`) | `nc_list_view_v2`, `nc_calendar_view_v2` |
| **View columns table** | Per-column settings for this view type | `nc_list_view_columns_v2`, `nc_grid_view_columns_v2` |
| **Child tables** (optional) | Additional related data | `nc_list_view_levels_v2`, `nc_calendar_view_range_v2` |

All views share the base `nc_views_v2` table (managed by `View.ts`). Your view type adds type-specific tables alongside it.

### Existing View Types for Reference

| View Type | View Model | Service | Has Child Table? |
|-----------|-----------|---------|-----------------|
| Grid | `GridView.ts` | `grids.service.ts` | No |
| Form | `FormView.ts` | `forms.service.ts` | No |
| Gallery | `GalleryView.ts` | `galleries.service.ts` | No |
| Kanban | `KanbanView.ts` | `kanbans.service.ts` | No |
| Calendar | `CalendarView.ts` | `calendars.service.ts` | Yes (`CalendarRange`) |
| List | `ListView.ts` | `lists.service.ts` | Yes (`ListViewLevel`) |

---

## Step 1: SDK Types & Swagger Schema

### Swagger (`packages/nocodb/src/schema/swagger.json`)

Add under `components.schemas`:

```json
"{ViewName}": {
  "description": "Model for {ViewName} View",
  "title": "{ViewName} Model",
  "type": "object",
  "properties": {
    "fk_view_id": { "type": "string" },
    "meta": { "$ref": "#/components/schemas/Meta" },
    "your_setting": { "type": "number" }
  }
},
"{ViewName}Column": {
  "description": "Model for {ViewName} Column",
  "title": "{ViewName}Column Model",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "fk_view_id": { "type": "string" },
    "fk_column_id": { "type": "string" },
    "show": { "type": "number" },
    "order": { "type": "number" },
    "width": { "type": "string" }
  }
},
"{ViewName}UpdateReq": {
  "description": "Model for {ViewName} Update Request",
  "title": "{ViewName}UpdateReq Model",
  "type": "object",
  "properties": {
    "meta": { "$ref": "#/components/schemas/Meta" },
    "your_setting": { "type": "number" }
  }
}
```

If you have child tables (like levels/ranges), add schemas for those too:

```json
"{ViewName}Child": { ... },
"{ViewName}ChildReq": { ... }
```

### Build SDK

```bash
cd packages/nocodb-sdk && pnpm run build:ee
```

This auto-generates types in `Api.ts` from swagger. Verify the generated interfaces match expectations.

---

## Step 2: Migration

**File**: `packages/nocodb/src/meta/migrations/v0/nc_{NNN}_{view_name}.ts`

### Key Rules

- View tables are **base-scoped**: composite PK `['base_id', 'fk_view_id']` + include `fk_workspace_id`
- View column/child tables are **base-scoped**: composite PK `['base_id', 'id']` + include `fk_workspace_id`
- Column IDs are `string('id', 20)`
- FK references are `string('fk_*', 20)` (no actual foreign key constraints)
- Always include timestamps: `table.timestamps(true, true)`
- Down migration must reverse all changes

> **Note on scoping:** Views are always base-scoped. Other entities may be workspace-scoped (just `id` PK + `fk_workspace_id`) or org-scoped (just `id` PK, no workspace/base IDs). See the backend SKILL.md for details.

```typescript
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // 1. View-specific settings table (1:1 with nc_views_v2)
  await knex.schema.createTable(MetaTable.{VIEW}_VIEW, (table) => {
    table.string('fk_view_id', 20);
    table.string('base_id', 20);
    table.string('source_id', 128);
    table.string('title');
    // View-level settings
    table.integer('row_height');
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'fk_view_id']);
  });

  // 2. View columns table (per-column display settings)
  await knex.schema.createTable(MetaTable.{VIEW}_VIEW_COLUMNS, (table) => {
    table.string('id', 20);
    table.string('base_id', 20);
    table.string('source_id', 128);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.boolean('show');
    table.float('order');
    table.string('width', 255);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
  });

  // 3. (Optional) Child table for extra data (levels, ranges, etc.)
  await knex.schema.createTable(MetaTable.{VIEW}_VIEW_CHILDREN, (table) => {
    table.string('id', 20);
    table.string('fk_view_id', 20);
    // Child-specific fields
    table.text('meta');
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
  });

  // 4. (Optional) ALTER existing tables if needed
  // e.g., adding fk_level_id to nc_sort_v2 / nc_filter_v2
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.string('fk_level_id', 20);
  });
};

const down = async (knex: Knex) => {
  // Reverse ALTER TABLE first
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.dropColumn('fk_level_id');
  });
  // Drop tables in reverse order
  await knex.schema.dropTable(MetaTable.{VIEW}_VIEW_CHILDREN);
  await knex.schema.dropTable(MetaTable.{VIEW}_VIEW_COLUMNS);
  await knex.schema.dropTable(MetaTable.{VIEW}_VIEW);
};

export { up, down };
```

### Register Migration

In `src/meta/migrations/v0/XcMigrationSourcev0.ts`:
1. Import the migration file
2. Add to `getMigrations()` array
3. Add case to `getMigration()` switch

---

## Step 3: Globals (CE + EE)

> **CRITICAL**: You MUST update BOTH CE and EE globals files. EE globals completely override CE — they don't inherit.

### CE Globals (`src/utils/globals.ts`)

```typescript
// MetaTable enum
export enum MetaTable {
  // ...existing
  {VIEW}_VIEW = 'nc_{view}_view_v2',
  {VIEW}_VIEW_COLUMNS = 'nc_{view}_view_columns_v2',
  {VIEW}_VIEW_CHILDREN = 'nc_{view}_view_children_v2',  // if applicable
}

// CacheScope enum
export enum CacheScope {
  // ...existing
  {VIEW}_VIEW = '{view}_view',
  {VIEW}_VIEW_COLUMN = '{view}_view_column',
  {VIEW}_VIEW_CHILD = '{view}_view_child',  // if applicable
}
```

### EE Globals (`src/ee/utils/globals.ts`)

Mirror the exact same entries. Also update:
- `BaseRelatedMetaTables` array
- `orderedMetaTables` array

### EE Meta Service (`src/ee/meta/meta.service.ts`)

Add nanoid prefixes in the `genNanoid()` prefixMap:

```typescript
[MetaTable.{VIEW}_VIEW]: 'lv',      // 2-letter prefix
[MetaTable.{VIEW}_VIEW_COLUMNS]: 'lvc',
[MetaTable.{VIEW}_VIEW_CHILDREN]: 'lvl',
```

---

## Step 4: Models

### View Model (`src/models/{ViewName}.ts`)

Follow the pattern of `CalendarView.ts` or `ListView.ts`:

```typescript
import type { {ViewName}Type } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse, stringifyMetaProp } from '~/utils/modelUtils';
import View from '~/models/View';

export default class {ViewName} implements {ViewName}Type {
  fk_view_id: string;
  title: string;
  meta?: MetaType;
  // ... view-specific fields

  constructor(data: {ViewName}) {
    Object.assign(this, data);
  }

  public static async get(context: NcContext, viewId: string, ncMeta = Noco.ncMeta) {
    let view = viewId && (await NocoCache.get(
      context,
      `${CacheScope.{VIEW}_VIEW}:${viewId}`,
      CacheGetType.TYPE_OBJECT,
    ));
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id, context.base_id,
        MetaTable.{VIEW}_VIEW,
        { fk_view_id: viewId },
      );
      view = prepareForResponse(view);
      await NocoCache.set(context, `${CacheScope.{VIEW}_VIEW}:${viewId}`, view);
    }

    // Load child data if applicable
    if (view) {
      view.children = await {ViewName}Child.list(context, viewId, ncMeta);
    }

    return view && new {ViewName}(view);
  }

  static async insert(context: NcContext, view: Partial<{ViewName}>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(view, [
      'base_id', 'source_id', 'fk_view_id', 'meta',
      // ... view-specific fields
    ]);

    if (insertObj.meta) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
    if (!insertObj.source_id) {
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(
      context.workspace_id, context.base_id,
      MetaTable.{VIEW}_VIEW, insertObj, true,
    );

    return this.get(context, view.fk_view_id, ncMeta);
  }

  static async update(context: NcContext, viewId: string, body: Partial<{ViewName}>, ncMeta = Noco.ncMeta) {
    const updateObj = extractProps(body, ['meta', /* view-specific fields */]);

    const res = await ncMeta.metaUpdate(
      context.workspace_id, context.base_id,
      MetaTable.{VIEW}_VIEW, prepareForDb(updateObj),
      { fk_view_id: viewId },
    );

    await NocoCache.update(context, `${CacheScope.{VIEW}_VIEW}:${viewId}`, prepareForResponse(updateObj));

    const view = await View.get(context, viewId);
    await View.clearSingleQueryCache(context, view.fk_model_id, [{ id: viewId }], ncMeta);

    return res;
  }
}
```

### View Column Model (`src/models/{ViewName}Column.ts`)

Standard pattern — see `GridViewColumn.ts` or `ListViewColumn.ts`. Key methods: `get`, `list`, `insert`, `update`.

> **CRITICAL insert order:** In `insert()`, always call `get()` before `appendToList()`. See [Cache Patterns in patterns.md](patterns.md#cache-patterns) for the correct pattern and why the order matters.

### Child Model (optional, `src/models/{ViewName}Child.ts`)

If your view has child data (like list view levels or calendar ranges), implement:
- `get`, `list`, `insert`, `update`, `delete`
- `bulkInsertOrUpdate` — for diff-based reconfiguration (see List View pattern below)
- Proper cache invalidation in all mutation methods

> **CRITICAL insert order:** Same rule applies to child model `insert()` — `get()` before `appendToList()`.

### Export Models

Add to `src/models/index.ts`:

```typescript
export { default as {ViewName} } from './{ViewName}';
export { default as {ViewName}Column } from './{ViewName}Column';
export { default as {ViewName}Child } from './{ViewName}Child';  // if applicable
```

---

## Step 5: View.ts Integration

`View.ts` is the central orchestrator for all view types. Multiple methods need updating.

### 5a. Table Name Mappings

In `extractViewTableName()`, `extractViewColumnsTableName()`, and their `Scope` counterparts:

```typescript
case ViewTypes.{VIEW}:
  return MetaTable.{VIEW}_VIEW;

case ViewTypes.{VIEW}:
  return MetaTable.{VIEW}_VIEW_COLUMNS;
```

### 5b. `getView()` (lazy-loads view-specific data)

```typescript
case ViewTypes.{VIEW}:
  this.view = await {ViewName}.get(context, this.id, ncMeta);
  break;
```

### 5c. `insert()` / `insertMetaOnly()` (CE + EE)

Both methods need identical changes:

```typescript
case ViewTypes.{VIEW}:
  await {ViewName}.insert(context, {
    ...(copyFromView?.view || {}),  // Spread source view settings when duplicating
    fk_view_id: view_id,
  }, ncMeta);
  break;
```

**If you have child data**, also copy it during duplication:

```typescript
// Build ID map for child records (old ID → new ID)
const childIdMap = new Map<string, string>();

case ViewTypes.{VIEW}:
  await {ViewName}.insert(context, {
    ...(copyFromView?.view || {}),
    fk_view_id: view_id,
  }, ncMeta);

  // Copy children
  if (copyFromView?.view?.children?.length) {
    for (const child of copyFromView.view.children) {
      const newChild = await {ViewName}Child.insert(context, {
        ...extractProps(child, [/* relevant fields */]),
        fk_view_id: view_id,
      }, ncMeta);
      childIdMap.set(child.id, newChild.id);
    }
  }
  break;
```

### 5d. Remap Child IDs in Sort/Filter Copy

If sorts/filters reference child IDs (e.g., `fk_level_id`), remap during copy:

```typescript
// In the sort copy section:
if (sortProps.fk_level_id) {
  sortProps.fk_level_id = childIdMap.get(sortProps.fk_level_id) || sortProps.fk_level_id;
}

// Same for filter copy
```

### 5e. `delete()` — Clean Up Child Data

```typescript
// After the Calendar range cleanup block:
if (view.type === ViewTypes.{VIEW}) {
  await ncMeta.metaDelete(
    context.workspace_id, context.base_id,
    MetaTable.{VIEW}_VIEW_CHILDREN,
    { fk_view_id: viewId },
  );
  await NocoCache.deepDel(
    context,
    `${CacheScope.{VIEW}_VIEW_CHILD}:${viewId}`,
    CacheDelDirection.CHILD_TO_PARENT,
  );
}
```

### 5f. View Column Insertion

In the section where view columns are created for the new view, add your view type case to create `{ViewName}Column` entries (similar to Grid/Gallery/Calendar/List patterns).

---

## Step 6: Service

**File**: `src/services/{views}.service.ts`

```typescript
@Injectable()
export class {ViewNames}Service {
  constructor(private readonly appHooksService: AppHooksService) {}

  async {viewName}Create(context: NcContext, param: {
    tableId: string;
    {viewName}: ViewCreateReqType;
    user: UserType;
    req: NcRequest;
    ownedBy?: string;
    viewWebhookManager?: ViewWebhookManager;
  }, ncMeta?: MetaService) {
    validatePayload('swagger.json#/components/schemas/ViewCreateReq', param.{viewName});

    // ... validation (schema_locked, duplicate title check)

    const viewWebhookManager = param.viewWebhookManager ?? /* build one */;

    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.{viewName},
        fk_model_id: param.tableId,
        type: ViewTypes.{VIEW},
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.user?.id,
      },
      model, req: param.req,
    });

    const view = await View.get(context, id);

    // Cache, events, socket broadcast
    this.appHooksService.emit(AppEvents.{VIEW}_CREATE, {
      view, req: param.req, owner, context,
    });

    // ViewWebhookManager emit
    NocoSocket.broadcastEvent(context, { ... });

    return view;
  }

  async {viewName}Update(context: NcContext, param: {
    {viewName}Id: string;
    {viewName}: {ViewName}UpdateReqType;
    req: NcRequest;
    viewWebhookManager?: ViewWebhookManager;
  }, ncMeta?: MetaService) {
    validatePayload('swagger.json#/components/schemas/{ViewName}UpdateReq', param.{viewName});

    const view = await View.get(context, param.{viewName}Id);
    const old{ViewName} = await {ViewName}.get(context, param.{viewName}Id);

    // Handle child data separately (e.g., levels, ranges)
    if (param.{viewName}.children) {
      await {ViewName}Child.bulkInsertOrUpdate(context, param.{viewName}Id, param.{viewName}.children);
    }

    // Strip children before updating view-level settings
    const { children: _children, ...updateData } = param.{viewName};
    await {ViewName}.update(context, param.{viewName}Id, updateData);

    this.appHooksService.emit(AppEvents.{VIEW}_UPDATE, {
      view,
      {viewName}View: param.{viewName},
      old{ViewName}View: old{ViewName},
      req: param.req, context, owner,
    });

    NocoSocket.broadcastEvent(context, { ... });
    return view;
  }
}
```

---

## Step 7: Operations & Module Registration

### Operation Scopes (`src/controllers/internal/operationScopes.ts`)

```typescript
{viewName}Create: 'base',
{viewName}Update: 'base',
```

### ACL Permissions

Add operation names in **BOTH** CE and EE ACL files (operation name = ACL key):

- CE: `src/utils/acl.ts`
- EE: `src/ee/utils/acl.ts`

**How view ACL works:**

Only **Creators** and **Owners** can create views or update shared views. **Editors** can update views only if it is their personal view (middleware handles the ownership check).

This is enforced through the ACL structure:

1. **`permissionScopes.base`** — Add both `{viewName}Create` and `{viewName}Update` to the base scope array. This registers them as base-level permissions.

2. **`ProjectRoles.EDITOR` include** — Add only `{viewName}Update: true`. This allows editors to update their personal views. Do NOT add `{viewName}Create` here — create operations stay at CREATOR level.

3. **`permissionDescriptions`** — Add descriptions for both operations.

```typescript
// permissionScopes.base array:
'{viewName}Create',
'{viewName}Update',

// ProjectRoles.EDITOR include (alongside other *ViewUpdate entries):
{viewName}Update: true,

// permissionDescriptions:
{viewName}Create: 'create {view name} view',
{viewName}Update: 'update {view name} view',
```

**Why this works:**
- Roles using `include` (VIEWER, COMMENTER, EDITOR) only get permissions explicitly listed in their `include` block
- Roles using `exclude` (CREATOR, OWNER) get ALL base permissions except what's excluded
- So `{viewName}Create` is only available to CREATOR/OWNER since it's not in any `include`
- `{viewName}Update` is available to EDITOR+ for personal views, and CREATOR/OWNER for all views

**Existing patterns to follow:**
- `gridViewCreate`, `formViewCreate`, `galleryViewCreate`, `calendarViewCreate` — NOT in EDITOR include (CREATOR+ only)
- `gridViewUpdate`, `galleryViewUpdate`, `kanbanViewUpdate`, `calendarViewUpdate` — in EDITOR include

### Extract-IDs Middleware — Personal View Permission Lists

The `AclMiddleware` in the extract-ids middleware has **three permission lists** that control personal view behavior. You must add `{viewName}Update` to all three lists in **BOTH** CE and EE middleware files:

- CE: `src/middlewares/extract-ids/extract-ids.middleware.ts`
- EE: `src/ee/middlewares/extract-ids/extract-ids.middleware.ts`

**1. `viewOperationsExcludedFromPersonalViewCheck`** — Operations excluded from the personal view non-owner write block. Without this, non-owners of a personal view would get "Unauthorized access" when trying to use `{viewName}Update` on a personal view they own.

**2. `editorPersonalViewOnlyPermissions`** — Operations that editors can ONLY perform on their own personal views. If an editor tries `{viewName}Update` on a shared/locked view, they are blocked.

**3. `personalViewOwnerAllowedPermissions`** — Operations that personal view owners can always perform regardless of their role (even viewers who own a personal view). This bypasses the normal role-based ACL check.

Add `'{viewName}Update'` after `'calendarViewUpdate'` in all three lists, following the existing view type pattern.

> **Note:** `{viewName}Create` does NOT need to be in these lists — view creation is a CREATOR+ only operation and is not related to personal view ownership.

### UiPost Operations (`src/controllers/internal/modules/UiPost.operations.ts`)

- Import `{ViewNames}Service`
- Add to constructor injection
- Add operation names to `operations` array
- Add cases to `handle()` switch

### EE UiPost Operations (`src/ee/controllers/internal/modules/UiPost.operations.ts`)

- Same pattern, but call `super()` constructor with the additional service

### Module Registration (`src/modules/noco.module.ts`)

```typescript
import { {ViewNames}Service } from '~/services/{views}.service';
// Add to providers array
```

---

## Step 8: App Events & Hooks

### AppEvents Enum (`packages/nocodb-sdk/src/lib/enums.ts`)

```typescript
export enum AppEvents {
  // ...existing
  {VIEW}_CREATE = '{view}.create',
  {VIEW}_UPDATE = '{view}.update',
  {VIEW}_DELETE = '{view}.delete',
}
```

### Event Interfaces (`src/services/app-hooks/interfaces.ts`)

```typescript
export interface {ViewName}ViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  {viewName}View: any;
  old{ViewName}View: any;
  owner: UserType;
}
```

### App Hooks Service — CE (`src/services/app-hooks/app-hooks.service.ts`)

Add emit overloads for the three new events:

```typescript
emit(event: AppEvents.{VIEW}_CREATE, data: ViewCreateEvent): void;
emit(event: AppEvents.{VIEW}_DELETE, data: ViewDeleteEvent): void;
emit(event: AppEvents.{VIEW}_UPDATE, data: ... | {ViewName}ViewUpdateEvent): void;
```

### App Hooks Service — EE (`src/ee/services/app-hooks/app-hooks.service.ts`)

Mirror the CE overloads.

---

## Step 9: Audit (EE app-hooks-listener)

### CE App Hooks Listener (`src/services/app-hooks-listener.service.ts`)

Add break cases so unhandled events don't fall through:

```typescript
case AppEvents.{VIEW}_CREATE:
  break;
case AppEvents.{VIEW}_UPDATE:
  // Add to existing combined update case
  break;
case AppEvents.{VIEW}_DELETE:
  break;
```

### EE App Hooks Listener (`src/ee/services/app-hooks-listener.service.ts`)

Three changes needed:

**1. Import the event type:**

```typescript
import { {ViewName}ViewUpdateEvent } from '~/services/app-hooks/interfaces';
```

**2. Add CREATE/DELETE audit cases** (follow Calendar pattern):

```typescript
case AppEvents.{VIEW}_CREATE:
  {
    const param = data as ViewCreateEvent;
    await this.auditInsert(
      await generateAuditV1Payload<ViewCreatePayload>(
        AuditV1OperationTypes.VIEW_CREATE,
        {
          details: {
            view_title: param.view.title,
            view_id: param.view.id,
            view_type: '{view}',
            ...extractNonSystemProps(
              await extractViewRelatedProps(param),
              ['title', 'type', 'id', 'fk_mode_id', 'owned_by', 'show'],
            ),
            view_owner_id: param.owner?.id,
            view_owner_email: param.owner?.email,
          },
          fk_model_id: param.view.fk_model_id,
          context: param.context,
          req: param.req,
        },
      ),
    );
  }
  break;
```

**3. Add UPDATE to the combined case:**

```typescript
// Add to the case list:
case AppEvents.{VIEW}_UPDATE:

// Add to the union type:
| {ViewName}ViewUpdateEvent

// Add handler in the inner switch:
case AppEvents.{VIEW}_UPDATE:
  next = await extractViewRelatedProps({
    view: (param as {ViewName}ViewUpdateEvent).{viewName}View,
    context: param.context,
  });
  prev = await extractViewRelatedProps({
    view: (param as {ViewName}ViewUpdateEvent).old{ViewName}View,
    context: param.context,
  });
  break;
```

### extractViewRelatedProps (`src/utils/audit.ts`)

If your view type has special FK references (like column IDs in children), add resolution logic:

```typescript
// Extract child column references for audit
if (Array.isArray(view.children) && view.children.length) {
  result.children = await Promise.all(
    view.children.map(async (child) => {
      const childResult: Record<string, any> = { /* scalar fields */ };
      if (child.fk_some_column_id) {
        const col = await Column.get(context, { colId: child.fk_some_column_id });
        childResult.some_field_id = col?.id;
        childResult.some_field_title = col?.title;
      }
      return childResult;
    }),
  );
}
```

---

## Checklist

### SDK & Schema
- [ ] Swagger schemas: View, ViewColumn, ViewUpdateReq (+ child schemas if applicable)
- [ ] SDK rebuilt: `pnpm run build:ee`
- [ ] Generated types verified in `Api.ts`

### Migration
- [ ] View table with composite PK `['base_id', 'fk_view_id']`
- [ ] View columns table with composite PK `['base_id', 'id']`
- [ ] Child table (if applicable) with composite PK `['base_id', 'id']`
- [ ] ALTER TABLE for existing tables (if applicable)
- [ ] Down migration reverses all changes
- [ ] Registered in `XcMigrationSourcev0.ts`

### Globals (BOTH CE + EE)
- [ ] MetaTable entries
- [ ] CacheScope entries
- [ ] EE: `BaseRelatedMetaTables` array updated
- [ ] EE: `orderedMetaTables` array updated
- [ ] EE: nanoid prefixes in `meta.service.ts`

### Models
- [ ] View model: get, insert, update (with child data loading in `get`)
- [ ] View column model: get, list, insert, update
- [ ] Child model (if applicable): get, list, insert, update, delete, bulkInsertOrUpdate
- [ ] All models exported from `src/models/index.ts`

### View.ts Integration
- [ ] Table name mappings (extractViewTableName, extractViewColumnsTableName, + Scope variants)
- [ ] `getView()` switch case
- [ ] `insert()` / `insertMetaOnly()` — CE and EE methods
- [ ] `copyFromView` spread in insert
- [ ] Child data copy with ID remapping (if applicable)
- [ ] Sort/filter FK remapping during copy (if applicable)
- [ ] `delete()` — child data cleanup

### Service
- [ ] Create method (validation, insert, events, socket broadcast)
- [ ] Update method (old data fetch, child handling, strip children, update, events)

### Operations & Module
- [ ] Operation scopes registered
- [ ] ACL in BOTH CE and EE `acl.ts`: Create in `permissionScopes.base` only (CREATOR+), Update also in EDITOR include
- [ ] Extract-IDs middleware: `{viewName}Update` in all 3 permission lists (CE + EE)
- [ ] UiPost operations (CE + EE)
- [ ] Service registered in `noco.module.ts`

### Events & Hooks
- [ ] AppEvents enum entries (SDK `enums.ts`)
- [ ] Event interface (e.g., `{ViewName}ViewUpdateEvent`)
- [ ] App hooks service emit overloads (CE + EE)

### Audit
- [ ] CE app-hooks-listener: break cases
- [ ] EE app-hooks-listener: CREATE, DELETE, UPDATE audit entries
- [ ] `extractViewRelatedProps` updated for child data (if applicable)

### EE Extras
- [ ] EE internal-type return types for GET/POST operations
- [ ] EE app-hooks emit overloads

---

## Pattern: Diff-Based Child Reconfiguration (List View Levels)

When your view type has child data that can be reconfigured (added/removed/reordered), use this diff-based approach:

```
Input: viewId, newChildren[]

1. Load existingChildren for this view
2. Build lookup: oldByKey = Map<unique_key, Child>  (e.g., fk_model_id)
3. Compute newKeys = Set of new children's unique keys

4. REMOVE: For each existing child where key NOT in newKeys:
   a. cleanupChildData(childId):  // Delete associated sorts/filters/columns
      - Query records by fk_child_id → NocoCache.deepDel(CHILD_TO_PARENT) each → bulk DB delete
   b. Delete the child record itself

5. PROCESS new children:
   For each new child:
   a. Key matches existing → UPDATE properties (preserves ID, associated data stays)
   b. Key is new → INSERT + create view columns for child

6. Return result[]
```

This preserves user configurations (sorts, filters, column widths) across reconfiguration changes.

### Cache Invalidation Patterns

#### Cleanup Associated Data

When deleting multiple child records by condition (e.g., all sorts for a level), always:
1. **Query** records by condition (get IDs)
2. **`NocoCache.deepDel(CHILD_TO_PARENT)`** for each record — removes from parent list + deletes item cache
3. **Bulk DB delete** via `metaDelete` with condition

Never skip step 2 — `metaDelete` alone does NOT clear the cache.

#### Insert Order

When inserting records that belong to a cached list, always `get()` before `appendToList()`:
- `get()` caches the individual item
- `appendToList()` reads the cached item and sets `parentKeys` on it
- If you call `appendToList()` first, it can't find the value → logs `"value is empty"` → `parentKeys` never set → later `deepDel(CHILD_TO_PARENT)` fails with `"getParents: parentKeys not found"`

See [Cache Patterns in patterns.md](patterns.md#cache-patterns) for the correct code pattern.

#### deepDel Direction

- **`CHILD_TO_PARENT`** — "I'm deleting this item; remove me from all parent lists": Used for individual item deletion
- **`PARENT_TO_CHILD`** — "I'm deleting this list; delete all children in it": Used for list cleanup (e.g., View.delete)

> **Common mistake:** Using `CacheScope.*` instead of `CacheDelDirection.*` as the third arg to `deepDel`. They're different enums.

---

## Frontend / UI Layer

After the backend meta layer is complete, the frontend needs these pieces.

### Step F1: View Store (`composables/useXxxViewStore.ts`)

Use the `useInjectionState` pattern. The store holds view-specific state derived from `viewMeta.value?.view`.

```typescript
const [useProvideXxxViewStore, useXxxViewStore] = useInjectionState(
  (meta: Ref<TableType | undefined>, viewMeta: Ref<ViewType | undefined>) => {
    const xxxMetaData = computed<XxxType | undefined>(() => viewMeta.value?.view as XxxType | undefined)
    // ... view-specific state and actions
    return { xxxMetaData, /* ... */ }
  },
  'xxxView',
)
```

**Provider**: Called in `Smartsheet.vue` alongside other view stores.

### Step F2: Toolbar Integration (`Toolbar.vue`)

- **View type conditionals** from `useSmartsheetStoreOrThrow()`: `isGrid`, `isForm`, `isKanban`, `isCalendar`, `isList`
- **Toolbar buttons** use classes `nc-toolbar-btn !border-0 !h-7`
- **`isToolbarIconMode`** support: icon-only when toolbar is narrow
- **`isLocked`** / `showAsDisabled` + `GeneralLockedViewFooter`
- Add your view type to existing toolbar menus' `v-if` conditions (FieldsMenu, ColumnFilterMenu, SortListMenu, etc.)
- Add new menu here if needed. Some view requires specific configurations

### Step F3: SmartsheetStoreEvents for Reload

When view configuration changes, emit reload events so toolbar menus refresh: Not necessary only if there is any direct dependencies for view options and filter

```typescript
eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
eventBus.emit(SmartsheetStoreEvents.FILTER_RELOAD)
```

### Frontend Checklist

- [ ] View store composable (`useInjectionState` pattern)
- [ ] Store provider in `Smartsheet.vue`
- [ ] View type added to `useSmartsheetStore` (`isXxx` computed)
- [ ] Toolbar buttons in `Toolbar.vue`
- [ ] Existing toolbar menus include your view type in `v-if` conditions
- [ ] Main view component (`components/smartsheet/Xxx.vue`)