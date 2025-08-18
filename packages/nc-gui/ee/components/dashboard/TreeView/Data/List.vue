<script setup lang="ts">
import type { SortableEvent } from 'sortablejs'
import Sortable from 'sortablejs'
import { type DashboardType, ModelTypes, type TableType } from 'nocodb-sdk'
const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { isMobileMode } = useGlobal()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { addUndo, defineModelScope } = useUndoRedo()

const dashboardStore = useDashboardStore()

const { activeTables } = storeToRefs(useTablesStore())

const { activeDashboardId, activeBaseDashboards } = storeToRefs(dashboardStore)

const base = inject(ProjectInj)!

const menuRef = useTemplateRef('menuRef')

const dragging = ref(false)

const isMarked = ref<string | false>(false)

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

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked.value = id
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

function onSortStart(evt: SortableEvent) {
  evt.stopImmediatePropagation()
  evt.preventDefault()
  dragging.value = true
}

async function onSortEnd(evt: SortableEvent, undo = false) {
  if (!undo) {
    evt.stopImmediatePropagation()
    evt.preventDefault()
    dragging.value = false
  }

  if (allEntities.value.length < 2) return

  let { newIndex = 0, oldIndex = 0 } = evt

  newIndex = newIndex - 1
  oldIndex = oldIndex - 1

  if (newIndex === oldIndex) return

  if (!undo) {
    addUndo({
      redo: {
        fn: async () => {
          const ord = sortable.toArray()
          const temp = ord.splice(oldIndex, 1)
          ord.splice(newIndex, 0, temp[0])
          sortable.sort(ord)
          await onSortEnd(evt, true)
        },
        args: [],
      },
      undo: {
        fn: async () => {
          const ord = sortable.toArray()
          const temp = ord.splice(newIndex, 1)
          ord.splice(oldIndex, 0, temp[0])
          sortable.sort(ord)
          await onSortEnd({ ...evt, oldIndex: newIndex, newIndex: oldIndex }, true)
        },
        args: [],
      },
      scope: defineModelScope({ base_id: baseId.value }),
    })
  }

  const children = Array.from(evt.to.children as unknown as HTMLElement[])

  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  const currentItem = allEntities.value.find((entity) => entity.id === evt.item.id)

  if (!currentItem || !currentItem.id) return

  // set default order value as 0 if item not found
  const previousItem = previousEl ? allEntities.value.find((entity) => entity.id === previousEl.id) ?? { order: 0 } : { order: 0 }
  const nextItem = nextEl ? allEntities.value.find((entity) => entity.id === nextEl.id) : {}

  let nextOrder: number

  // set new order value based on the new order of the items
  if (allEntities.value.length - 1 === newIndex) {
    nextOrder = parseFloat(String(previousItem.order)) + 1
  } else if (newIndex === 0) {
    nextOrder = parseFloat(String(nextItem.order)) / 2
  } else {
    nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  currentItem.order = _nextOrder

  // Update the item based on its type (dashboard or table) - SINGLE API CALL
  if (currentItem.type === 'dashboard') {
    await dashboardStore.updateDashboard(baseId.value, currentItem.id, {
      order: _nextOrder,
    })
  } else if (currentItem.type === 'table') {
    await $api.dbTable.reorder(currentItem.id, {
      order: _nextOrder,
    })
  }

  markItem(currentItem.id)

  $e('a:data:reorder')
}

const initSortable = (el: HTMLElement) => {
  if (sortable) sortable.destroy()
  if (isMobileMode.value) return

  sortable = new Sortable(el, {
    ghostClass: 'ghost',
    onStart: onSortStart,
    onEnd: onSortEnd,
    filter: isTouchEvent,
  })
}

onMounted(() => {
  if (!menuRef.value || !isUIAllowed('viewCreateOrEdit')) return
  initSortable(menuRef.value)
})
</script>

<template>
  <div>
    <div ref="menuRef" :class="{ dragging }" class="nc-data-menu flex flex-col w-full !border-r-0 !bg-inherit">
      <template v-for="entity of allEntities" :key="entity.id">
        <DashboardTreeViewDashboardNode
          v-if="entity.type === ModelTypes.DASHBOARD"
          :id="entity.id"
          :data-order="entity.order"
          class="nc-dashboard-item nc-tree-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
          :class="{
            'bg-gray-200': isMarked === entity.id,
            'active': activeDashboardId === entity.id,
          }"
          :dashboard="entity"
        />
        <DashboardTreeViewTableNode
          v-else
          :id="entity.id"
          class="nc-tree-item text-sm"
          :data-order="entity.order"
          :data-id="entity.id"
          :table="entity"
          :base="base!"
          :source-index="0"
          :data-title="entity.title"
          :data-type="entity.type"
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
