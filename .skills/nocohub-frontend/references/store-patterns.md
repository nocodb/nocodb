# Pinia Store Patterns Reference

Complete Pinia store patterns for NocoDB frontend development.

## Basic Store Structure

```typescript
// store/myFeature.ts
import type { TableType, ViewType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useMyFeatureStore = defineStore('myFeatureStore', () => {
  // ============================================
  // DEPENDENCIES
  // ============================================
  const { api, isLoading: apiLoading } = useApi()
  const router = useRouter()
  const route = router.currentRoute
  const { t } = useI18n()

  // ============================================
  // STATE
  // ============================================
  const items = ref<TableType[]>([])
  const selectedId = ref<string | null>(null)
  const isInitialized = ref(false)
  const error = ref<string | null>(null)

  // ============================================
  // COMPUTED
  // ============================================
  const selectedItem = computed(() =>
    items.value.find(item => item.id === selectedId.value)
  )

  const itemCount = computed(() => items.value.length)

  const isEmpty = computed(() => items.value.length === 0)

  const sortedItems = computed(() =>
    [...items.value].sort((a, b) =>
      (a.title || '').localeCompare(b.title || '')
    )
  )

  const itemsById = computed(() =>
    items.value.reduce((acc, item) => {
      if (item.id) acc[item.id] = item
      return acc
    }, {} as Record<string, TableType>)
  )

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Load all items for a base
   */
  async function loadItems(baseId: string, force = false) {
    if (isInitialized.value && !force) return

    error.value = null

    try {
      const response = await api.dbTable.list(baseId)
      items.value = response.list || []
      isInitialized.value = true
    } catch (e: any) {
      error.value = e.message
      message.error(t('msg.error.loadFailed'))
      console.error('Failed to load items:', e)
    }
  }

  /**
   * Create a new item
   */
  async function createItem(
    baseId: string,
    data: Partial<TableType>
  ): Promise<TableType | null> {
    try {
      const newItem = await api.dbTable.create(baseId, data)
      items.value.push(newItem)
      message.success(t('msg.success.created'))
      return newItem
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return null
    }
  }

  /**
   * Update an existing item
   */
  async function updateItem(
    tableId: string,
    data: Partial<TableType>
  ): Promise<TableType | null> {
    try {
      const updated = await api.dbTable.update(tableId, data)
      const index = items.value.findIndex(item => item.id === tableId)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...updated }
      }
      message.success(t('msg.success.updated'))
      return updated
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return null
    }
  }

  /**
   * Delete an item
   */
  async function deleteItem(tableId: string): Promise<boolean> {
    try {
      await api.dbTable.delete(tableId)
      items.value = items.value.filter(item => item.id !== tableId)

      // Clear selection if deleted item was selected
      if (selectedId.value === tableId) {
        selectedId.value = null
      }

      message.success(t('msg.success.deleted'))
      return true
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    }
  }

  /**
   * Set the currently selected item
   */
  function setSelectedId(id: string | null) {
    selectedId.value = id
  }

  /**
   * Get item by ID (from cache)
   */
  function getItemById(id: string): TableType | undefined {
    return itemsById.value[id]
  }

  /**
   * Reset store state
   */
  function reset() {
    items.value = []
    selectedId.value = null
    isInitialized.value = false
    error.value = null
  }

  // ============================================
  // WATCHERS
  // ============================================

  // Auto-load when base changes
  watch(
    () => route.value.params.baseId,
    (baseId) => {
      if (baseId && typeof baseId === 'string') {
        loadItems(baseId)
      } else {
        reset()
      }
    },
    { immediate: true }
  )

  // ============================================
  // RETURN PUBLIC API
  // ============================================
  return {
    // State (readonly where appropriate)
    items: readonly(items),
    selectedId,
    isInitialized: readonly(isInitialized),
    error: readonly(error),
    isLoading: apiLoading,

    // Computed
    selectedItem,
    itemCount,
    isEmpty,
    sortedItems,
    itemsById,

    // Actions
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    setSelectedId,
    getItemById,
    reset,
  }
})

// HMR support for development
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMyFeatureStore as any, import.meta.hot))
}
```

## Store with Nested Data

```typescript
// store/bases.ts
import type { BaseType, SourceType, TableType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useBasesStore = defineStore('basesStore', () => {
  const { api } = useApi()

  // ============================================
  // STATE - Using Maps for nested data
  // ============================================
  const bases = ref<Map<string, BaseType>>(new Map())
  const baseTables = ref<Map<string, TableType[]>>(new Map())
  const baseSources = ref<Map<string, SourceType[]>>(new Map())
  const baseUsers = ref<Map<string, any[]>>(new Map())

  const activeBaseId = ref<string | null>(null)
  const isLoading = ref(false)

  // ============================================
  // COMPUTED
  // ============================================
  const activeBase = computed(() =>
    activeBaseId.value ? bases.value.get(activeBaseId.value) : undefined
  )

  const basesList = computed(() =>
    Array.from(bases.value.values())
  )

  const activeTables = computed(() =>
    activeBaseId.value ? baseTables.value.get(activeBaseId.value) || [] : []
  )

  const activeSources = computed(() =>
    activeBaseId.value ? baseSources.value.get(activeBaseId.value) || [] : []
  )

  // ============================================
  // ACTIONS
  // ============================================

  async function loadBases() {
    isLoading.value = true
    try {
      const response = await api.base.list()
      bases.value.clear()
      for (const base of response.list || []) {
        if (base.id) {
          bases.value.set(base.id, base)
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  async function loadBase(baseId: string) {
    const base = await api.base.read(baseId)
    bases.value.set(baseId, base)
    return base
  }

  async function loadBaseTables(baseId: string, force = false) {
    if (!force && baseTables.value.has(baseId)) {
      return baseTables.value.get(baseId)
    }

    const response = await api.dbTable.list(baseId)
    baseTables.value.set(baseId, response.list || [])
    return response.list
  }

  async function loadBaseSources(baseId: string) {
    const response = await api.source.list(baseId)
    baseSources.value.set(baseId, response.list || [])
    return response.list
  }

  function setActiveBase(baseId: string | null) {
    activeBaseId.value = baseId
  }

  function updateBaseInStore(baseId: string, data: Partial<BaseType>) {
    const existing = bases.value.get(baseId)
    if (existing) {
      bases.value.set(baseId, { ...existing, ...data })
    }
  }

  function addTableToBase(baseId: string, table: TableType) {
    const tables = baseTables.value.get(baseId) || []
    baseTables.value.set(baseId, [...tables, table])
  }

  function removeTableFromBase(baseId: string, tableId: string) {
    const tables = baseTables.value.get(baseId) || []
    baseTables.value.set(
      baseId,
      tables.filter(t => t.id !== tableId)
    )
  }

  function reset() {
    bases.value.clear()
    baseTables.value.clear()
    baseSources.value.clear()
    baseUsers.value.clear()
    activeBaseId.value = null
  }

  return {
    // State
    bases,
    baseTables,
    baseSources,
    baseUsers,
    activeBaseId,
    isLoading: readonly(isLoading),

    // Computed
    activeBase,
    basesList,
    activeTables,
    activeSources,

    // Actions
    loadBases,
    loadBase,
    loadBaseTables,
    loadBaseSources,
    setActiveBase,
    updateBaseInStore,
    addTableToBase,
    removeTableFromBase,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBasesStore as any, import.meta.hot))
}
```

## Store with Event Hooks

```typescript
// store/tables.ts
import type { TableType } from 'nocodb-sdk'
import { createEventHook } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useTablesStore = defineStore('tablesStore', () => {
  const { api } = useApi()

  // State
  const tables = ref<Map<string, TableType>>(new Map())
  const baseTables = ref<Map<string, TableType[]>>(new Map())

  // Event hooks for external subscriptions
  const tableCreatedHook = createEventHook<TableType>()
  const tableUpdatedHook = createEventHook<TableType>()
  const tableDeletedHook = createEventHook<string>()

  // Actions
  async function createTable(baseId: string, data: Partial<TableType>) {
    const table = await api.dbTable.create(baseId, data)

    // Update local state
    tables.value.set(table.id!, table)
    const existing = baseTables.value.get(baseId) || []
    baseTables.value.set(baseId, [...existing, table])

    // Trigger event
    tableCreatedHook.trigger(table)

    return table
  }

  async function updateTable(tableId: string, data: Partial<TableType>) {
    const updated = await api.dbTable.update(tableId, data)

    // Update in tables map
    tables.value.set(tableId, updated)

    // Update in baseTables
    for (const [baseId, tableList] of baseTables.value) {
      const index = tableList.findIndex(t => t.id === tableId)
      if (index !== -1) {
        tableList[index] = updated
        baseTables.value.set(baseId, [...tableList])
        break
      }
    }

    // Trigger event
    tableUpdatedHook.trigger(updated)

    return updated
  }

  async function deleteTable(tableId: string) {
    await api.dbTable.delete(tableId)

    // Remove from tables map
    tables.value.delete(tableId)

    // Remove from baseTables
    for (const [baseId, tableList] of baseTables.value) {
      const filtered = tableList.filter(t => t.id !== tableId)
      if (filtered.length !== tableList.length) {
        baseTables.value.set(baseId, filtered)
        break
      }
    }

    // Trigger event
    tableDeletedHook.trigger(tableId)
  }

  return {
    tables,
    baseTables,

    createTable,
    updateTable,
    deleteTable,

    // Expose event subscriptions
    onTableCreated: tableCreatedHook.on,
    onTableUpdated: tableUpdatedHook.on,
    onTableDeleted: tableDeletedHook.on,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTablesStore as any, import.meta.hot))
}
```

## Store Composition (Using Other Stores)

```typescript
// store/workspace.ts
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'

export const useWorkspaceStore = defineStore('workspaceStore', () => {
  const { api } = useApi()

  // Use other stores
  const basesStore = useBasesStore()
  const tablesStore = useTablesStore()
  const { basesList } = storeToRefs(basesStore)

  // State
  const activeWorkspaceId = ref<string | null>(null)
  const workspaces = ref<Map<string, any>>(new Map())

  // Computed combining multiple stores
  const activeWorkspaceBases = computed(() =>
    basesList.value.filter(
      base => base.fk_workspace_id === activeWorkspaceId.value
    )
  )

  const workspaceTableCount = computed(() => {
    let count = 0
    for (const base of activeWorkspaceBases.value) {
      if (base.id) {
        count += tablesStore.baseTables.get(base.id)?.length || 0
      }
    }
    return count
  })

  // Actions that orchestrate multiple stores
  async function loadWorkspace(workspaceId: string) {
    activeWorkspaceId.value = workspaceId

    // Load workspace data
    const workspace = await api.orgWorkspace.read(workspaceId)
    workspaces.value.set(workspaceId, workspace)

    // Load related data from other stores
    await basesStore.loadBases()

    // Load tables for each base
    for (const base of activeWorkspaceBases.value) {
      if (base.id) {
        await basesStore.loadBaseTables(base.id)
      }
    }
  }

  async function deleteWorkspace(workspaceId: string) {
    // Delete all bases first
    for (const base of activeWorkspaceBases.value) {
      if (base.id) {
        await api.base.delete(base.id)
      }
    }

    // Delete workspace
    await api.orgWorkspace.delete(workspaceId)

    // Clean up state
    workspaces.value.delete(workspaceId)
    if (activeWorkspaceId.value === workspaceId) {
      activeWorkspaceId.value = null
    }

    // Reload bases
    await basesStore.loadBases()
  }

  return {
    activeWorkspaceId,
    workspaces,
    activeWorkspaceBases,
    workspaceTableCount,
    loadWorkspace,
    deleteWorkspace,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspaceStore as any, import.meta.hot))
}
```

## Store with Optimistic Updates

```typescript
// store/rows.ts
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useRowsStore = defineStore('rowsStore', () => {
  const { api } = useApi()

  const rows = ref<Map<string, any[]>>(new Map())
  const pendingOperations = ref<Map<string, 'create' | 'update' | 'delete'>>(new Map())

  // Optimistic create
  async function createRow(viewId: string, data: any) {
    const tempId = `temp_${Date.now()}`
    const viewRows = rows.value.get(viewId) || []

    // Optimistically add row
    const optimisticRow = { ...data, id: tempId, _pending: true }
    rows.value.set(viewId, [...viewRows, optimisticRow])
    pendingOperations.value.set(tempId, 'create')

    try {
      const created = await api.dbViewRow.create(viewId, data)

      // Replace optimistic row with real one
      const currentRows = rows.value.get(viewId) || []
      rows.value.set(
        viewId,
        currentRows.map(r => r.id === tempId ? created : r)
      )
      pendingOperations.value.delete(tempId)

      return created
    } catch (e) {
      // Rollback on failure
      const currentRows = rows.value.get(viewId) || []
      rows.value.set(
        viewId,
        currentRows.filter(r => r.id !== tempId)
      )
      pendingOperations.value.delete(tempId)
      throw e
    }
  }

  // Optimistic update
  async function updateRow(viewId: string, rowId: string, data: any) {
    const viewRows = rows.value.get(viewId) || []
    const originalRow = viewRows.find(r => r.id === rowId)

    if (!originalRow) throw new Error('Row not found')

    // Optimistically update
    rows.value.set(
      viewId,
      viewRows.map(r => r.id === rowId ? { ...r, ...data, _pending: true } : r)
    )
    pendingOperations.value.set(rowId, 'update')

    try {
      const updated = await api.dbViewRow.update(viewId, rowId, data)

      // Apply server response
      const currentRows = rows.value.get(viewId) || []
      rows.value.set(
        viewId,
        currentRows.map(r => r.id === rowId ? { ...updated, _pending: false } : r)
      )
      pendingOperations.value.delete(rowId)

      return updated
    } catch (e) {
      // Rollback
      const currentRows = rows.value.get(viewId) || []
      rows.value.set(
        viewId,
        currentRows.map(r => r.id === rowId ? originalRow : r)
      )
      pendingOperations.value.delete(rowId)
      throw e
    }
  }

  // Optimistic delete
  async function deleteRow(viewId: string, rowId: string) {
    const viewRows = rows.value.get(viewId) || []
    const originalIndex = viewRows.findIndex(r => r.id === rowId)
    const originalRow = viewRows[originalIndex]

    if (originalIndex === -1) throw new Error('Row not found')

    // Optimistically remove
    rows.value.set(
      viewId,
      viewRows.filter(r => r.id !== rowId)
    )
    pendingOperations.value.set(rowId, 'delete')

    try {
      await api.dbViewRow.delete(viewId, rowId)
      pendingOperations.value.delete(rowId)
    } catch (e) {
      // Rollback - insert back at original position
      const currentRows = rows.value.get(viewId) || []
      currentRows.splice(originalIndex, 0, originalRow)
      rows.value.set(viewId, [...currentRows])
      pendingOperations.value.delete(rowId)
      throw e
    }
  }

  const isRowPending = (rowId: string) =>
    pendingOperations.value.has(rowId)

  return {
    rows,
    pendingOperations: readonly(pendingOperations),
    createRow,
    updateRow,
    deleteRow,
    isRowPending,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRowsStore as any, import.meta.hot))
}
```

## Store Usage in Components

```vue
<script lang="ts" setup>
  import { storeToRefs } from 'pinia'

  // Access store
  const store = useMyFeatureStore()

  // Extract reactive refs (preserves reactivity)
  const { items, selectedItem, isLoading } = storeToRefs(store)

  // Actions can be destructured directly (they're functions, not reactive)
  const { createItem, updateItem, deleteItem } = store

  // Or access everything via store instance
  const handleCreate = async () => {
    await store.createItem(baseId, { title: 'New Item' })
  }

  // Watch store state
  watch(
    () => store.selectedId,
    (newId) => {
      console.log('Selection changed:', newId)
    }
  )
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <ul v-else>
    <li
      v-for="item in items"
      :key="item.id"
      :class="{ active: item.id === store.selectedId }"
      @click="store.setSelectedId(item.id)"
    >
      {{ item.title }}
    </li>
  </ul>
</template>
```

## EE Store Extension Pattern

```typescript
// ee/store/myFeature.ts
import { useMyFeatureStore as useMyFeatureStoreCE } from '~/store/myFeature'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'

export const useMyFeatureStore = defineStore('myFeatureStore', () => {
  // Get CE store instance
  const ceStore = useMyFeatureStoreCE()

  // EE-specific state
  const eeData = ref<any[]>([])
  const eeIsLoading = ref(false)

  // EE-specific actions
  async function loadEEData() {
    eeIsLoading.value = true
    try {
      eeData.value = await api.ee.getData()
    } finally {
      eeIsLoading.value = false
    }
  }

  // Return merged CE + EE
  return {
    // Spread all CE store properties
    ...ceStore,

    // EE additions
    eeData: readonly(eeData),
    eeIsLoading: readonly(eeIsLoading),
    loadEEData,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMyFeatureStore as any, import.meta.hot))
}
```