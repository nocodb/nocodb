# Common Code Patterns

This document provides quick reference for frequently used code patterns across the NocoDB Hub codebase.

## Backend Patterns

### Controller Pattern

**Location**: `packages/nocodb/src/controllers/`

```typescript
import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import type { NcContext, NcRequest } from 'nocodb-sdk';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class MyController {
  constructor(protected readonly myService: MyService) {}

  @Acl('actionName', { scope: 'org' })  // or 'workspace', 'base'
  @Get(['/api/v1/db/meta/my-resource/', '/api/v2/meta/my-resource/'])
  async list(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest
  ) {
    return await this.myService.list(context, {
      user: req.user,
      query: req.query
    });
  }

  @Acl('actionCreate', { scope: 'base' })
  @Post(['/api/v1/db/meta/my-resource/', '/api/v2/meta/my-resource/'])
  async create(
    @TenantContext() context: NcContext,
    @Body() body: MyCreateReq,
    @Req() req: NcRequest
  ) {
    return await this.myService.create(context, {
      user: req.user,
      data: body
    });
  }
}
```

**Key characteristics**:
- Dual guards: `MetaApiLimiterGuard` (rate limiting) + `GlobalGuard` (auth)
- Dual API versioning: `/api/v1/...` and `/api/v2/...`
- `@Acl()` decorator for permission checks
- `@TenantContext()` injects `NcContext` with workspace/base IDs
- `@Req()` provides `NcRequest` with user metadata

### Service Pattern

**Location**: `packages/nocodb/src/services/`

```typescript
import { Injectable } from '@nestjs/common';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { AppEvents } from 'nocodb-sdk';

@Injectable()
export class MyService {
  constructor(
    protected readonly appHooksService: AppHooksService,
  ) {}

  async list(context: NcContext, param: { user, query }) {
    // Business logic
    const items = await MyModel.list(context, param);

    // Emit event
    this.appHooksService.emit(AppEvents.MY_LIST, {
      req: param.req,
      items
    });

    return items;
  }

  async create(context: NcContext, param: { user, data }) {
    // Validate payload
    validatePayload(
      'swagger.json#/components/schemas/MyCreateReq',
      param.data
    );

    // Business logic with error handling
    if (!param.data.title) {
      throw NcError.badRequest('Title is required');
    }

    // Create via model
    const result = await MyModel.insert(context, param.data);

    // Emit event
    this.appHooksService.emit(AppEvents.MY_CREATE, {
      user: param.user,
      item: result
    });

    return result;
  }
}
```

**Key characteristics**:
- Dependency injection via constructor
- `context: NcContext` first parameter for tenant isolation
- `validatePayload()` for request validation
- `NcError` for throwing errors
- Event emission via `appHooksService`

### Model Pattern

**Location**: `packages/nocodb/src/models/`

```typescript
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import type { MyType } from 'nocodb-sdk';

export default class MyModel implements MyType {
  id: string;
  title: string;
  description?: string;
  base_id: string;
  created_at: string;
  updated_at: string;

  constructor(data: Partial<MyModel>) {
    Object.assign(this, data);
  }

  public static castType(obj: MyModel): MyModel {
    return obj && new MyModel(obj);
  }

  // List records
  public static async list(
    context: NcContext,
    param: { baseId: string }
  ): Promise<MyModel[]> {
    const list = await Noco.ncMeta.metaList2(
      RootScopes.ROOT,
      param.baseId,
      MetaTable.MY_TABLE,
      {
        condition: { base_id: param.baseId },
        orderBy: { created_at: 'desc' }
      }
    );
    return list?.map((item) => this.castType(item));
  }

  // Get single record
  public static async get(
    context: NcContext,
    id: string
  ): Promise<MyModel> {
    const item = await Noco.ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MY_TABLE,
      { id }
    );

    if (!item) {
      NcError.notFound(`Item ${id} not found`);
    }

    return this.castType(item);
  }

  // Insert record
  public static async insert(
    context: NcContext,
    data: Partial<MyType>
  ): Promise<MyModel> {
    const result = await Noco.ncMeta.metaInsert2(
      RootScopes.ROOT,
      data.base_id,
      MetaTable.MY_TABLE,
      {
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      }
    );

    return this.castType(result);
  }

  // Update record
  public static async update(
    context: NcContext,
    id: string,
    data: Partial<MyType>
  ): Promise<MyModel> {
    await Noco.ncMeta.metaUpdate2(
      RootScopes.ROOT,
      data.base_id,
      MetaTable.MY_TABLE,
      { ...data, updated_at: new Date() },
      { id }
    );

    return this.get(context, id);
  }

  // Delete record
  public static async delete(
    context: NcContext,
    id: string
  ): Promise<boolean> {
    await Noco.ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MY_TABLE,
      { id }
    );

    return true;
  }
}
```

**Key characteristics**:
- Static factory methods for CRUD
- `castType()` for type safety
- Uses `Noco.ncMeta` for database access
- Implements interface from `nocodb-sdk`
- Throws `NcError` for errors

### Error Handling Pattern

```typescript
import { NcError } from 'nocodb-sdk';

// Bad request (400)
throw NcError.badRequest('Invalid input');

// Unauthorized (401)
throw NcError.unauthorized('Not authorized');

// Forbidden (403)
throw NcError.forbidden('Access denied');

// Not found (404)
throw NcError.notFound('Resource not found');

// Conflict (409)
throw NcError.conflict('Resource already exists');

// Unprocessable entity (422)
throw NcError.unprocessableEntity('Cannot process request');

// Internal server error (500)
throw NcError.internalServerError('Something went wrong');
```

### Caching Pattern

```typescript
import { NocoCache } from '~/cache/NocoCache';
import { CacheScope, CacheGetType } from '~/utils/globals';

// Get from cache
const cached = await NocoCache.get(
  context,
  `${CacheScope.BASE}:${baseId}`,
  CacheGetType.TYPE_OBJECT
);

if (cached) {
  return cached;
}

// Fetch from database
const data = await MyModel.get(context, baseId);

// Store in cache
await NocoCache.set(
  context,
  `${CacheScope.BASE}:${baseId}`,
  data
);

return data;
```

### Deleting Cache

```typescript
// Simple delete
await NocoCache.del(
  context,
  `${CacheScope.BASE}:${baseId}`
);

// Deep delete (with parent/child relationships)
await NocoCache.deepDel(
  context,
  `${CacheScope.BASE}:${baseId}`,
  CacheDelDirection.CHILD_TO_PARENT
);
```

## Frontend Patterns

### Component Pattern (Script Setup)

**Location**: `packages/nc-gui/components/`

```vue
<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'

interface Props {
  table: TableType
  view?: ViewType
  isReadonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  view: undefined,
  isReadonly: false
})

interface Emits {
  (e: 'update:view', value: ViewType): void
  (e: 'delete'): void
}

const emit = defineEmits<Emits>()

// Composables
const { api, isLoading } = useApi()
const { t } = useI18n()
const { $e } = useNuxtApp()

// Local state
const isEditing = ref(false)
const localData = ref<ViewType | null>(null)

// Computed
const viewTitle = computed(() => props.view?.title || t('general.untitled'))

// Watch props
watch(() => props.view, (newView) => {
  localData.value = newView ? { ...newView } : null
})

// Methods
async function save() {
  if (!localData.value) return

  isLoading.value = true
  try {
    const updated = await api.dbView.update(localData.value.id, localData.value)
    emit('update:view', updated)
    message.success(t('msg.success.updated'))
    $e('a:view:update')
  } catch (e: any) {
    const errorMsg = await extractSdkResponseErrorMsg(e)
    message.error(errorMsg)
  } finally {
    isLoading.value = false
  }
}

// Lifecycle
onMounted(() => {
  // Initialize
})
</script>

<template>
  <div class="nc-my-component">
    <a-input
      v-model:value="localData.title"
      :disabled="isReadonly"
      @blur="save"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-my-component {
  padding: 12px;
}
</style>
```

### Composable Pattern (Injection State)

**Location**: `packages/nc-gui/composables/`

```typescript
import { useInjectionState } from '#app'
import type { TableType, ViewType } from 'nocodb-sdk'

const [useProvideMyStore, useMyStore] = useInjectionState(
  (table: Ref<TableType>) => {
    const { api } = useApi()

    // State
    const data = ref<any[]>([])
    const isLoading = ref(false)

    // Computed
    const rowCount = computed(() => data.value.length)

    // Methods
    async function loadData() {
      isLoading.value = true
      try {
        const response = await api.dbViewRow.list(
          'noco',
          table.value.base_id,
          table.value.id,
          'default'
        )
        data.value = response.list
      } catch (e) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isLoading.value = false
      }
    }

    return {
      data,
      isLoading,
      rowCount,
      loadData
    }
  }
)

export { useProvideMyStore }

export function useMyStoreOrThrow() {
  const state = useMyStore()
  if (!state) {
    throw new Error('useMyStore: store not provided')
  }
  return state
}
```

### Pinia Store Pattern

**Location**: `packages/nc-gui/store/`

```typescript
import { defineStore } from 'pinia'
import type { BaseType } from 'nocodb-sdk'

export const useMyStore = defineStore('myStore', () => {
  const { api } = useApi()

  // State - use Map for performance with large datasets
  const items = ref<Map<string, BaseType>>(new Map())
  const activeItemId = ref<string | null>(null)

  // Getters
  const itemsList = computed(() => Array.from(items.value.values()))
  const activeItem = computed(() =>
    activeItemId.value ? items.value.get(activeItemId.value) : null
  )

  // Actions
  async function loadItems() {
    const list = await api.base.list()
    items.value = new Map(list.map(item => [item.id, item]))
  }

  async function createItem(data: Partial<BaseType>) {
    const newItem = await api.base.create(data)
    items.value.set(newItem.id, newItem)
    return newItem
  }

  async function updateItem(id: string, data: Partial<BaseType>) {
    const updated = await api.base.update(id, data)
    items.value.set(id, updated)
    return updated
  }

  async function deleteItem(id: string) {
    await api.base.delete(id)
    items.value.delete(id)
    if (activeItemId.value === id) {
      activeItemId.value = null
    }
  }

  function setActiveItem(id: string | null) {
    activeItemId.value = id
  }

  return {
    items,
    itemsList,
    activeItem,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    setActiveItem
  }
})
```

### API Call Pattern

```typescript
const { api } = useApi()
const { t } = useI18n()

async function performAction() {
  try {
    const response = await api.dbTable.create(baseId, {
      title: 'New Table',
      table_name: 'new_table'
    })

    message.success(t('msg.success.tableCreated'))
    return response
  } catch (e: any) {
    const errorMsg = await extractSdkResponseErrorMsg(e)
    message.error(errorMsg)
  }
}
```

### v-model Pattern

```vue
<script setup lang="ts">
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

// Use vueuse helper
const localValue = useVModel(props, 'modelValue', emit)
</script>

<template>
  <input v-model="localValue" />
</template>
```

### Provide/Inject Pattern

```typescript
// Parent component
const myValue = ref('hello')
provide('myKey', myValue)

// Child component
const myValue = inject<Ref<string>>('myKey')
if (!myValue) {
  throw new Error('myKey not provided')
}
```

## Type Import Pattern

### Backend

```typescript
import type {
  NcContext,
  NcRequest,
  UserType,
  BaseType,
  TableType,
  ColumnType,
  ViewType
} from 'nocodb-sdk';

import {
  AppEvents,
  OrgUserRoles,
  ProjectRoles,
  WorkspaceUserRoles,
  NcError
} from 'nocodb-sdk';
```

### Frontend

```typescript
import type {
  Api,
  BaseType,
  TableType,
  ColumnType,
  ViewType,
  FilterType,
  SortType
} from 'nocodb-sdk'
```

## Event Emission Pattern

### Backend

```typescript
this.appHooksService.emit(AppEvents.TABLE_CREATE, {
  table: result,
  user: param.user,
  req: param.req
});
```

### Frontend (Event Bus)

```typescript
const { $e } = useNuxtApp()

// Track event
$e('a:table:create')
$e('c:column:delete', { column_type: 'text' })
```

## Permission Checking Pattern

### Backend (ACL Decorator)

```typescript
@Acl('tableList', { scope: 'base' })           // Base scope
@Acl('baseCreate', { scope: 'workspace' })     // Workspace scope
@Acl('userList', { scope: 'org' })             // Org scope
@Acl('dataList', { blockApiTokenAccess: true }) // Block API tokens
```

### Frontend (UI Permission)

```typescript
import { isUIAllowed } from '~/lib/acl'

const canCreate = computed(() => isUIAllowed('tableCreate'))
const canEdit = computed(() => isUIAllowed('tableUpdate'))
```

## Validation Pattern

### Backend

```typescript
import { validatePayload } from '~/helpers';

validatePayload(
  'swagger.json#/components/schemas/TableReq',
  req.body
);
```

### Frontend

```typescript
import { validateTableName } from '~/utils/formValidations'

const rules = {
  title: [
    { required: true, message: t('msg.error.required') },
    { max: 255, message: t('msg.error.maxLength', { max: 255 }) }
  ],
  table_name: [
    { required: true, message: t('msg.error.required') },
    { validator: validateTableName }
  ]
}
```

## Loading State Pattern

### Backend (Service)

No explicit loading state needed - handled by frontend.

### Frontend (Component)

```typescript
const isLoading = ref(false)

async function loadData() {
  isLoading.value = true
  try {
    const data = await api.dbTable.list(baseId)
    // Handle data
  } catch (e) {
    // Handle error
  } finally {
    isLoading.value = false
  }
}
```

### Frontend (Store)

```typescript
const isLoading = ref(false)
const error = ref<string | null>(null)

async function loadItems() {
  isLoading.value = true
  error.value = null
  try {
    const list = await api.base.list()
    items.value = new Map(list.map(item => [item.id, item]))
  } catch (e: any) {
    error.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isLoading.value = false
  }
}
```

## See Also

- [Backend Architecture](./backend-architecture.md) - Backend structure
- [Frontend Architecture](./frontend-architecture.md) - Frontend structure
- [SDK & Types](./sdk-and-types.md) - Type definitions
