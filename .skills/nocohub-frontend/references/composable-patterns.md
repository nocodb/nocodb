# Composable Patterns Reference

Complete composable patterns for NocoDB frontend development.

## Pattern 1: Simple Utility Composable

Stateless helper functions that use Vue's reactivity system.

```typescript
// composables/useTableHelpers.ts
import type { ColumnType, TableType } from 'nocodb-sdk'

export function useTableHelpers(table: Ref<TableType | undefined>) {
  const { t } = useI18n()

  // Computed values derived from input
  const columns = computed<ColumnType[]>(() => table.value?.columns || [])

  const primaryColumn = computed(() =>
    columns.value.find(col => col.pv)
  )

  const visibleColumns = computed(() =>
    columns.value.filter(col => !col.system)
  )

  const columnCount = computed(() => columns.value.length)

  // Pure helper functions
  const getColumnById = (id: string) =>
    columns.value.find(col => col.id === id)

  const getColumnByTitle = (title: string) =>
    columns.value.find(col => col.title === title)

  const isColumnEditable = (column: ColumnType) => {
    if (column.pk) return false
    if (column.ai) return false
    if (column.system) return false
    return true
  }

  return {
    columns,
    primaryColumn,
    visibleColumns,
    columnCount,
    getColumnById,
    getColumnByTitle,
    isColumnEditable,
  }
}
```

## Pattern 2: Injection State Composable

For sharing state within a component tree. Uses provide/inject under the hood.

```typescript
// composables/useSmartsheetStore/index.ts
import type { Ref } from 'vue'
import type { FilterType, SortType, TableType, ViewType } from 'nocodb-sdk'

// Create paired provider and injector functions
const [useProvideSmartsheetStore, useSmartsheetStore] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | undefined>,
    shared = false,
    initialSorts?: Ref<SortType[]>,
    initialFilters?: Ref<FilterType[]>,
  ) => {
    const { api } = useApi()
    const { t } = useI18n()

    // State
    const rows = ref<Row[]>([])
    const isLoading = ref(false)
    const pagination = ref<PaginatedType>({
      page: 1,
      pageSize: 25,
      totalRows: 0,
    })

    // Sorts and filters
    const sorts = ref<SortType[]>(initialSorts?.value || [])
    const filters = ref<FilterType[]>(initialFilters?.value || [])

    // Computed
    const viewId = computed(() => view.value?.id)
    const tableId = computed(() => meta.value?.id)

    const hasFilters = computed(() => filters.value.length > 0)
    const hasSorts = computed(() => sorts.value.length > 0)

    // Actions
    const loadData = async (params?: { page?: number }) => {
      if (!viewId.value) return

      isLoading.value = true
      try {
        const response = await api.dbViewRow.list(
          'noco',
          meta.value!.base_id!,
          tableId.value!,
          viewId.value,
          {
            offset: ((params?.page || pagination.value.page) - 1) * pagination.value.pageSize,
            limit: pagination.value.pageSize,
            filterArr: filters.value,
            sortArr: sorts.value,
          }
        )

        rows.value = response.list.map((row: any) => ({
          row,
          rowMeta: { new: false },
        }))
        pagination.value.totalRows = response.pageInfo.totalRows || 0
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isLoading.value = false
      }
    }

    const addSort = (sort: SortType) => {
      sorts.value.push(sort)
      loadData()
    }

    const removeSort = (index: number) => {
      sorts.value.splice(index, 1)
      loadData()
    }

    const addFilter = (filter: FilterType) => {
      filters.value.push(filter)
      loadData()
    }

    const removeFilter = (index: number) => {
      filters.value.splice(index, 1)
      loadData()
    }

    const changePage = async (page: number) => {
      pagination.value.page = page
      await loadData({ page })
    }

    const refresh = () => loadData()

    // Watch for view changes
    watch(viewId, () => {
      if (viewId.value) {
        loadData()
      }
    }, { immediate: true })

    return {
      // State
      rows: readonly(rows),
      isLoading: readonly(isLoading),
      pagination,
      sorts,
      filters,

      // Computed
      viewId,
      tableId,
      hasFilters,
      hasSorts,

      // Actions
      loadData,
      addSort,
      removeSort,
      addFilter,
      removeFilter,
      changePage,
      refresh,
    }
  },
  'smartsheet-store',
)

// Export the provider function
export { useProvideSmartsheetStore }

// Export a throwing version for required injection
export function useSmartsheetStoreOrThrow() {
  const store = useSmartsheetStore()
  if (!store) {
    throw new Error('Please call `useProvideSmartsheetStore` on the appropriate parent component')
  }
  return store
}
```

### Usage in Components

```vue
<!-- Parent component - Provider -->
<script lang="ts" setup>
const view = inject(ViewInj)
const meta = inject(TableInj)

// Provide store to all descendants
useProvideSmartsheetStore(view, meta)
</script>

<template>
  <SmartsheetGrid />
  <SmartsheetToolbar />
</template>
```

```vue
<!-- Child component - Consumer -->
<script lang="ts" setup>
const { rows, isLoading, pagination, changePage } = useSmartsheetStoreOrThrow()
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else v-for="row in rows" :key="row.row.id">
    {{ row.row }}
  </div>
  <a-pagination
    :current="pagination.page"
    :total="pagination.totalRows"
    @change="changePage"
  />
</template>
```

## Pattern 3: Global State Composable

Singleton state shared across the entire app. Persists across component lifecycles.

```typescript
// composables/useGlobal/index.ts
import { createGlobalState } from '@vueuse/core'
import type { User } from 'nocodb-sdk'

interface StoredState {
  token: string | null
  lang: string
  darkMode: boolean
  sidebarWidth: number
}

export const useGlobal = createGlobalState(() => {
  const { provide } = useNuxtApp()

  // Persisted storage
  const storage = useStorage<StoredState>('nocodb-gui-v2', {
    token: null,
    lang: 'en',
    darkMode: false,
    sidebarWidth: 250,
  })

  // Non-persisted state
  const user = ref<User | null>(null)
  const isLoading = ref(false)

  // Computed from storage
  const token = computed({
    get: () => storage.value.token,
    set: (val) => { storage.value.token = val },
  })

  const lang = toRef(storage.value, 'lang')
  const darkMode = toRef(storage.value, 'darkMode')
  const sidebarWidth = toRef(storage.value, 'sidebarWidth')

  // Derived state
  const signedIn = computed(() => !!token.value)

  const jwtPayload = computed(() => {
    if (!token.value) return null
    try {
      return jwtDecode(token.value)
    } catch {
      return null
    }
  })

  // Actions
  const signIn = async (credentials: { email: string; password: string }) => {
    isLoading.value = true
    try {
      const response = await $api.auth.signin(credentials)
      token.value = response.token
      user.value = response.user
    } finally {
      isLoading.value = false
    }
  }

  const signOut = async () => {
    try {
      await $api.auth.signout()
    } finally {
      token.value = null
      user.value = null
    }
  }

  const toggleDarkMode = () => {
    darkMode.value = !darkMode.value
  }

  // Watch token to update user
  watch(jwtPayload, (payload) => {
    if (payload) {
      user.value = {
        id: payload.id,
        email: payload.email,
        roles: payload.roles,
      }
    }
  }, { immediate: true })

  const globalState = {
    // State
    token,
    user,
    lang,
    darkMode,
    sidebarWidth,
    isLoading,

    // Computed
    signedIn,
    jwtPayload,

    // Actions
    signIn,
    signOut,
    toggleDarkMode,
  }

  // Provide for legacy inject usage
  provide('state', globalState)

  return globalState
})
```

## Pattern 4: API Composable

Wrapping API calls with loading, error handling, and caching.

```typescript
// composables/useApi.ts
import type { Api } from 'nocodb-sdk'
import { Api as ApiClass } from 'nocodb-sdk'

export function useApi(options: { useGlobalInstance?: boolean } = {}) {
  const { useGlobalInstance = true } = options

  const { token } = useGlobal()
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // Create or get global API instance
  const api = useGlobalInstance
    ? (useNuxtApp().$api as Api<any>)
    : new ApiClass({
        baseURL: '/api/v1',
        headers: {
          'xc-auth': token.value || '',
        },
      })

  // Wrapper for API calls with loading state
  const exec = async <T>(
    fn: () => Promise<T>,
    options?: {
      showError?: boolean
      errorMessage?: string
    }
  ): Promise<T | null> => {
    const { showError = true, errorMessage } = options || {}

    isLoading.value = true
    error.value = null

    try {
      return await fn()
    } catch (e: any) {
      error.value = e
      if (showError) {
        const msg = errorMessage || await extractSdkResponseErrorMsg(e)
        message.error(msg)
      }
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    api,
    isLoading: readonly(isLoading),
    error: readonly(error),
    exec,
  }
}
```

## Pattern 5: Dialog/Modal Composable

Managing dialog state and lifecycle.

```typescript
// composables/useDialog.ts
export function useDialog<T = any>(defaultValue?: T) {
  const isOpen = ref(false)
  const data = ref<T | undefined>(defaultValue)
  const resolveCallback = ref<((value: T | undefined) => void) | null>(null)

  const open = (initialData?: T): Promise<T | undefined> => {
    data.value = initialData
    isOpen.value = true

    return new Promise((resolve) => {
      resolveCallback.value = resolve
    })
  }

  const close = (result?: T) => {
    isOpen.value = false
    if (resolveCallback.value) {
      resolveCallback.value(result)
      resolveCallback.value = null
    }
  }

  const confirm = (result: T) => {
    close(result)
  }

  const cancel = () => {
    close(undefined)
  }

  return {
    isOpen: readonly(isOpen),
    data: readonly(data),
    open,
    close,
    confirm,
    cancel,
  }
}

// Usage
const { isOpen, data, open, confirm, cancel } = useDialog<{ id: string; name: string }>()

// Open and wait for result
const result = await open({ id: '123', name: 'Test' })
if (result) {
  // User confirmed
}
```

## Pattern 6: Debounced/Throttled Composable

For search and input handling.

```typescript
// composables/useSearch.ts
export function useSearch(options: {
  onSearch: (query: string) => Promise<void>
  debounceMs?: number
  minLength?: number
}) {
  const { onSearch, debounceMs = 300, minLength = 1 } = options

  const query = ref('')
  const isSearching = ref(false)

  const debouncedSearch = useDebounceFn(async (searchQuery: string) => {
    if (searchQuery.length < minLength) return

    isSearching.value = true
    try {
      await onSearch(searchQuery)
    } finally {
      isSearching.value = false
    }
  }, debounceMs)

  watch(query, (newQuery) => {
    debouncedSearch(newQuery)
  })

  const clear = () => {
    query.value = ''
  }

  return {
    query,
    isSearching: readonly(isSearching),
    clear,
  }
}
```

## Pattern 7: Undo/Redo Composable

State history management.

```typescript
// composables/useUndoRedo.ts
export function useUndoRedo<T>(initialValue: T, maxHistory = 50) {
  const state = ref<T>(initialValue) as Ref<T>
  const history = ref<T[]>([initialValue])
  const historyIndex = ref(0)

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  const pushState = (newState: T) => {
    // Remove any redo history
    history.value = history.value.slice(0, historyIndex.value + 1)

    // Add new state
    history.value.push(structuredClone(newState))

    // Limit history size
    if (history.value.length > maxHistory) {
      history.value.shift()
    } else {
      historyIndex.value++
    }

    state.value = newState
  }

  const undo = () => {
    if (!canUndo.value) return

    historyIndex.value--
    state.value = structuredClone(history.value[historyIndex.value])
  }

  const redo = () => {
    if (!canRedo.value) return

    historyIndex.value++
    state.value = structuredClone(history.value[historyIndex.value])
  }

  const clear = () => {
    history.value = [state.value]
    historyIndex.value = 0
  }

  return {
    state,
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
    clear,
  }
}
```

## Pattern 8: Event Hook Composable

For pub/sub within component trees.

```typescript
// composables/useEventBus.ts
import { createEventHook } from '@vueuse/core'

export function useTableEvents() {
  const onRowCreated = createEventHook<{ tableId: string; row: any }>()
  const onRowUpdated = createEventHook<{ tableId: string; rowId: string; data: any }>()
  const onRowDeleted = createEventHook<{ tableId: string; rowId: string }>()

  return {
    // Triggers
    triggerRowCreated: onRowCreated.trigger,
    triggerRowUpdated: onRowUpdated.trigger,
    triggerRowDeleted: onRowDeleted.trigger,

    // Listeners
    onRowCreated: onRowCreated.on,
    onRowUpdated: onRowUpdated.on,
    onRowDeleted: onRowDeleted.on,
  }
}

// Usage
const events = useTableEvents()

// Subscribe
events.onRowCreated(({ tableId, row }) => {
  console.log('Row created:', row)
})

// Emit
events.triggerRowCreated({ tableId: '123', row: { id: 'abc' } })
```

## Pattern 9: Form Composable

Form state and validation.

```typescript
// composables/useForm.ts
import type { Rule } from 'ant-design-vue/es/form'

interface FormField<T> {
  value: T
  rules?: Rule[]
  error?: string
}

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validationRules?: Partial<Record<keyof T, Rule[]>>
) {
  const values = reactive<T>({ ...initialValues })
  const errors = reactive<Partial<Record<keyof T, string>>>({})
  const touched = reactive<Partial<Record<keyof T, boolean>>>({})
  const isSubmitting = ref(false)

  const isDirty = computed(() => {
    return Object.keys(values).some(
      key => values[key as keyof T] !== initialValues[key as keyof T]
    )
  })

  const isValid = computed(() => {
    return Object.keys(errors).length === 0
  })

  const validate = async (): Promise<boolean> => {
    // Clear existing errors
    Object.keys(errors).forEach(key => delete errors[key as keyof T])

    // Run validation rules
    for (const [field, rules] of Object.entries(validationRules || {})) {
      for (const rule of rules || []) {
        const value = values[field as keyof T]

        if (rule.required && !value) {
          errors[field as keyof T] = rule.message as string || 'Required'
          break
        }

        if (rule.min && typeof value === 'string' && value.length < rule.min) {
          errors[field as keyof T] = rule.message as string || `Minimum ${rule.min} characters`
          break
        }

        // Add more validation types as needed
      }
    }

    return isValid.value
  }

  const reset = () => {
    Object.assign(values, initialValues)
    Object.keys(errors).forEach(key => delete errors[key as keyof T])
    Object.keys(touched).forEach(key => delete touched[key as keyof T])
  }

  const setFieldValue = <K extends keyof T>(field: K, value: T[K]) => {
    values[field] = value
    touched[field] = true
  }

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    validate,
    reset,
    setFieldValue,
  }
}
```

## EE Composable Extension Pattern

Extending CE composables with EE features:

```typescript
// ee/composables/useMyFeature.ts
import { useMyFeature as useMyFeatureCE } from '~/composables/useMyFeature'
import type { Api } from 'nocodb-sdk'

export function useMyFeature(table: Ref<TableType | undefined>) {
  // Get all CE functionality
  const ceFeature = useMyFeatureCE(table)

  // Add EE-specific state
  const { api } = useApi()
  const eeData = ref<any[]>([])
  const isEELoading = ref(false)

  // EE-specific computed
  const hasEEData = computed(() => eeData.value.length > 0)

  // EE-specific actions
  const loadEEData = async () => {
    if (!table.value?.id) return

    isEELoading.value = true
    try {
      eeData.value = await (api as Api<any>).ee.getTableData(table.value.id)
    } finally {
      isEELoading.value = false
    }
  }

  // Return merged CE + EE
  return {
    ...ceFeature,

    // EE additions
    eeData: readonly(eeData),
    isEELoading: readonly(isEELoading),
    hasEEData,
    loadEEData,
  }
}
```

## useInjectionState Implementation Reference

The custom `useInjectionState` helper:

```typescript
// composables/useInjectionState/index.ts
import type { InjectionKey } from 'vue'

export function useInjectionState<Arguments extends any[], Return>(
  composable: (...args: Arguments) => Return,
  keyName = 'InjectionState',
): readonly [
  useInjectionState: (...args: Arguments) => Return,
  useInjectedState: () => Return | undefined
] {
  const key: string | InjectionKey<Return> = Symbol(keyName)

  let providableState: Return | undefined

  const useProvidingState = (...args: Arguments) => {
    const providedState = composable(...args)
    provide(key, providedState)
    providableState = providedState

    tryOnScopeDispose(() => {
      providableState = undefined
    })

    return providedState
  }

  const useInjectedState = () => {
    let injection = inject(key, undefined)

    if (typeof injection === 'undefined') {
      injection = providableState
    }

    return injection
  }

  tryOnScopeDispose(() => {
    providableState = undefined
  })

  return [useProvidingState, useInjectedState]
}
```
