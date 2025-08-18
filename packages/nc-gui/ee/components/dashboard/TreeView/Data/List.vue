<script setup lang="ts">
import Sortable from 'sortablejs'
import { type DashboardType, ModelTypes, type TableType } from 'nocodb-sdk'
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isMobileMode } = useGlobal()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const dashboardStore = useDashboardStore()

const { activeTables } = storeToRefs(useTablesStore())

const { activeDashboardId, activeBaseDashboards } = storeToRefs(dashboardStore)

const base = inject(ProjectInj)!

const menuRef = useTemplateRef('menuRef')

const isMarked = ref<string | false>(false)

const keys = ref<Record<string, number>>({})

let sortable: Sortable

const allEntities = computed<Array<(DashboardType & { type: 'dashboard' }) | (TableType & { type: 'table' })>>(() => {
  const entities = []

  // Add dashboards with type identifier
  for (const dashboard of activeBaseDashboards.value) {
    entities.push({ ...dashboard, type: 'dashboard' as const })
  }

  // Add tables from default source with type identifier
  if (base.value?.sources?.length && base.value?.sources?.[0]?.enabled) {
    const sourceId = base.value?.sources?.[0]?.id
    for (const table of activeTables.value) {
      if (table.source_id !== sourceId) continue
      entities.push({ ...table, type: 'table' as const })
    }
  }

  return entities.sort((a, b) => (a.order || 0) - (b.order || 0))
})

// Create entities by ID lookup for efficient access
const entitiesById = computed(() =>
  allEntities.value.reduce<Record<string, any>>((acc, entity) => {
    acc[entity.id!] = entity
    return acc
  }, {}),
)

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked.value = id
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

// todo: replace with vuedraggable
const initSortable = (el: Element) => {
  if (isMobileMode.value) return
  if (sortable) sortable.destroy()

  sortable = Sortable.create(el as HTMLElement, {
    onEnd: async (evt) => {
      const { newIndex = 0, oldIndex = 0 } = evt

      if (newIndex === oldIndex) return

      const itemEl = evt.item as HTMLElement
      const item = entitiesById.value[itemEl.dataset.id as string]

      if (!item) return

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLElement
      const itemAfterEl = children[newIndex + 1] as HTMLElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && entitiesById.value[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && entitiesById.value[itemAfterEl.dataset.id as string]

      // set new order value based on the new order of the items
      if (children.length - 1 === evt.newIndex) {
        item.order = (itemBefore?.order as number) + 1
      } else if (newIndex === 0) {
        item.order = (itemAfter?.order as number) / 2
      } else {
        item.order = ((itemBefore?.order as number) + (itemAfter?.order as number)) / 2
      }

      // force re-render the list
      if (keys.value.data) {
        keys.value.data = keys.value.data + 1
      } else {
        keys.value.data = 1
      }

      // Update local state
      if (item.type === 'dashboard') {
        // Update local dashboard order in the store
        const dashboards = activeBaseDashboards.value
        const dashboardIndex = dashboards.findIndex(d => d.id === item.id)
        if (dashboardIndex !== -1) {
          // Remove from old position and insert at new position
          const [movedDashboard] = dashboards.splice(dashboardIndex, 1)
          movedDashboard.order = item.order

          // Find the correct insertion index based on the new order
          const insertIndex = dashboards.findIndex(d => (d.order || 0) > item.order)
          if (insertIndex === -1) {
            dashboards.push(movedDashboard)
          } else {
            dashboards.splice(insertIndex, 0, movedDashboard)
          }
        }

        await dashboardStore.updateDashboard(baseId.value, item.id, {
          order: item.order,
        })
      } else if (item.type === 'table') {
        // Update local table order in the store
        const tables = activeTables.value
        const tableIndex = tables.findIndex(t => t.id === item.id)
        if (tableIndex !== -1) {
          // Remove from old position and insert at new position
          const [movedTable] = tables.splice(tableIndex, 1)
          movedTable.order = item.order

          // Find the correct insertion index based on the new order
          const insertIndex = tables.findIndex(t => (t.order || 0) > item.order)
          if (insertIndex === -1) {
            tables.push(movedTable)
          } else {
            tables.splice(insertIndex, 0, movedTable)
          }
        }

        await $api.dbTable.reorder(item.id as string, {
          order: item.order,
        })
      }

      markItem(item.id)
      $e('a:data:reorder')
    },
    setData(dataTransfer, dragEl) {
      if (!dragEl?.dataset?.sourceId) {
        return
      }
      dataTransfer.setData(
        'text/json',
        JSON.stringify({
          id: dragEl.dataset.id,
          title: dragEl.dataset.title,
          type: dragEl.dataset.type,
          sourceId: dragEl.dataset.sourceId,
        }),
      )
    },
    animation: 150,
    revertOnSpill: true,
    filter: isTouchEvent,
  })
}

watchEffect(() => {
  if (menuRef.value && isUIAllowed('viewCreateOrEdit')) {
    initSortable(menuRef.value)
  }
})
</script>

<template>
  <div>
    <div ref="menuRef" :key="`data-${keys.data || 0}`" class="nc-data-menu flex flex-col w-full !border-r-0 !bg-inherit">
      <template v-for="entity of allEntities" :key="entity.id">
        <DashboardTreeViewDashboardNode
          v-if="entity.type === ModelTypes.DASHBOARD"
          :data-id="entity.id"
          :data-order="entity.order"
          :data-title="entity.title"
          :data-type="entity.type"
          class="nc-dashboard-item nc-tree-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
          :class="{
            'bg-gray-200': isMarked === entity.id,
            'active': activeDashboardId === entity.id,
          }"
          :dashboard="entity"
        />
        <DashboardTreeViewTableNode
          v-else
          :data-id="entity.id"
          :data-order="entity.order"
          :data-title="entity.title"
          :data-type="entity.type"
          class="nc-tree-item text-sm"
          :data-source-id="entity?.source_id"
          :table="entity"
          :base="base!"
          :source-index="0"
        />
      </template>
    </div>
    <DashboardTreeViewDataSourceList :base-id="baseId" />
  </div>
</template>

<style lang="scss">
.nc-data-menu {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  &.dragging {
    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition;
  }

  .ant-menu-title-content {
    @apply !w-full;
  }

  .sortable-chosen {
    @apply !bg-gray-200;
  }

  .active {
    @apply !bg-primary-selected font-medium;
  }
}
</style>
