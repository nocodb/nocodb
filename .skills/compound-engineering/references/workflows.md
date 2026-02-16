# Cross-Package Workflow Reference

## Table of Contents

1. [New Feature Checklist](#new-feature-checklist)
2. [SDK-First Development](#sdk-first-development)
3. [Migration Coordination](#migration-coordination)
4. [Real-Time Feature Pattern](#real-time-feature-pattern)

---

## New Feature Checklist

Use this checklist for any feature spanning multiple packages:

### Pre-Development

- [ ] Define feature scope (CE vs EE)
- [ ] Design API contract (endpoints, request/response shapes)
- [ ] Identify affected packages
- [ ] Check for similar existing patterns

### SDK Phase

- [ ] Add TypeScript interfaces to `Api.ts` (or `EeApi.ts` for EE)
- [ ] Add request/response types
- [ ] Add API client methods
- [ ] Add events to `enums.ts` if needed
- [ ] Build SDK: `pnpm run build:ee`

### Backend Phase

- [ ] Create model in `src/models/`
- [ ] Create service in `src/services/`
- [ ] Register operations in internal controllers (`operationScopes.ts` + `UiPost/UiGet.operations.ts`)
- [ ] Add ACL permissions in BOTH `src/utils/acl.ts` and `src/ee/utils/acl.ts` (operation name = ACL key)
- [ ] Create migration in `src/meta/migrations/v0/`
- [ ] Register service in `noco.module.ts`
- [ ] Update MetaTable/CacheScope in BOTH CE and EE `globals.ts`
- [ ] Update nanoid prefixes in BOTH CE and EE `meta.service.ts`
- [ ] Update swagger schema
- [ ] Write unit tests

### Frontend Phase

- [ ] Create composable in `composables/`
- [ ] Create components in `components/`
- [ ] Add i18n translations in `lang/`
- [ ] Integrate into existing UI
- [ ] Handle loading/error states

### Integration

- [ ] Test full flow locally
- [ ] Run type checks across all packages
- [ ] Run E2E tests if available

---

## SDK-First Development

### Why SDK-First?

1. **Contract-driven**: API contract is defined before implementation
2. **Type safety**: TypeScript catches mismatches early
3. **Parallel development**: Frontend can mock while backend implements

### Pattern

```typescript
// 1. Define types in nocodb-sdk/src/lib/Api.ts
export interface WidgetType {
  id: string;
  title: string;
  config: Record<string, any>;
  fk_dashboard_id: string;
}

export interface WidgetReqType {
  title: string;
  config?: Record<string, any>;
}

export interface WidgetListType {
  list: WidgetType[];
  pageInfo: PaginatedType;
}

// 2. Add API client methods
widget: {
  list: (dashboardId: string, params?: RequestParams) =>
    this._get<WidgetListType>(`/api/v2/meta/dashboards/${dashboardId}/widgets`, params),
  read: (widgetId: string) =>
    this._get<WidgetType>(`/api/v2/meta/widgets/${widgetId}`),
  create: (dashboardId: string, data: WidgetReqType) =>
    this._post<WidgetType>(`/api/v2/meta/dashboards/${dashboardId}/widgets`, data),
  update: (widgetId: string, data: Partial<WidgetReqType>) =>
    this._patch<WidgetType>(`/api/v2/meta/widgets/${widgetId}`, data),
  delete: (widgetId: string) =>
    this._delete(`/api/v2/meta/widgets/${widgetId}`),
}
```

---

## Migration Coordination

### Database + Code Changes

When adding a new table or column:

1. **Create migration** (backend)
   ```typescript
   // packages/nocodb/src/meta/migrations/v0/nc_XXX_add_widgets.ts
   const up = async (knex: Knex) => {
     await knex.schema.createTable(MetaTable.WIDGETS, (table) => {
       table.string('id', 20);
       table.string('base_id', 20);
       table.string('title', 255).notNullable();
       table.text('config');
       table.string('fk_dashboard_id', 20);
       table.string('fk_workspace_id', 20);
       table.timestamps(true, true);

       table.primary(['base_id', 'id']);
     });
   };
   ```
   > **Note:** NocoDB does NOT use foreign key constraints. Primary keys and scoping depend on entity scope:
   > - **Base scope**: composite PK `['base_id', 'id']` + `fk_workspace_id`
   > - **Workspace scope**: just `id` PK + `fk_workspace_id`, no `base_id`
   > - **Org scope**: just `id` PK, no `fk_workspace_id` or `base_id`

2. **Add MetaTable enum** (backend)
   ```typescript
   // packages/nocodb/src/utils/globals.ts
   export enum MetaTable {
     WIDGETS = 'nc_widgets',
   }
   ```

3. **Create model** (backend)
   ```typescript
   // packages/nocodb/src/models/Widget.ts
   export default class Widget implements WidgetType {
     // Implementation
   }
   ```

### Backward Compatibility

For existing tables, use safe migrations:

```typescript
// Adding a nullable column (safe)
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.EXISTING, (table) => {
    table.string('new_field', 255).nullable();
  });
};

// Adding a column with default (safe)
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.EXISTING, (table) => {
    table.boolean('is_active').defaultTo(true);
  });
};
```

---

## Real-Time Feature Pattern

For features needing real-time updates (e.g., collaborative editing):

### 1. Define Events (SDK)

```typescript
// nocodb-sdk/src/lib/enums.ts
export enum AppEvents {
  WIDGET_CREATE = 'widget.create',
  WIDGET_UPDATE = 'widget.update',
  WIDGET_DELETE = 'widget.delete',
}

export enum ClientEvents {
  WIDGET_CHANGED = 'widget:changed',
}
```

### 2. Emit Events (Backend)

```typescript
// packages/nocodb/src/services/widget.service.ts
async create(param: { dashboardId: string; body: WidgetReqType; req: NcRequest }) {
  const widget = await Widget.insert({
    ...param.body,
    fk_dashboard_id: param.dashboardId,
  });

  // Emit for audit/webhooks
  this.appHooksService.emit(AppEvents.WIDGET_CREATE, {
    widget,
    dashboardId: param.dashboardId,
    req: param.req,
  });

  // Emit for real-time sync
  this.socketService.broadcast(ClientEvents.WIDGET_CHANGED, {
    type: 'create',
    dashboardId: param.dashboardId,
    widget,
  });

  return widget;
}
```

### 3. Handle Events (Frontend)

```typescript
// packages/nc-gui/composables/useWidgets.ts
export function useWidgets(dashboardId: Ref<string>) {
  const { api } = useApi()
  const { socket } = useSocket()

  const widgets = ref<WidgetType[]>([])

  // Initial load
  const loadWidgets = async () => {
    const response = await api.widget.list(dashboardId.value)
    widgets.value = response.list
  }

  // Real-time updates
  const handleWidgetChange = (data: { type: string; widget: WidgetType }) => {
    if (data.dashboardId !== dashboardId.value) return

    switch (data.type) {
      case 'create':
        widgets.value.push(data.widget)
        break
      case 'update':
        const idx = widgets.value.findIndex(w => w.id === data.widget.id)
        if (idx !== -1) widgets.value[idx] = data.widget
        break
      case 'delete':
        widgets.value = widgets.value.filter(w => w.id !== data.widget.id)
        break
    }
  }

  onMounted(() => {
    socket.on(ClientEvents.WIDGET_CHANGED, handleWidgetChange)
  })

  onUnmounted(() => {
    socket.off(ClientEvents.WIDGET_CHANGED, handleWidgetChange)
  })

  return { widgets, loadWidgets }
}
```