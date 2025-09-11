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

const { baseTables } = storeToRefs(useTablesStore())

const { activeDashboardId, activeBaseDashboards } = storeToRefs(dashboardStore)

const { isSharedBase } = storeToRefs(useBase())

const base = inject(ProjectInj)!

const tables = computed(() => baseTables.value.get(base.value.id!) ?? [])

const menuRef = useTemplateRef('menuRef')

const isMarked = ref<string | false>(false)

const keys = ref<Record<string, number>>({})

let sortable: Sortable

const hasTableCreatePermission = computed(() => {
  return isUIAllowed('tableCreate', { roles: base.value.project_role, source: base.value?.sources?.[0] })
})

const allEntities = computed<Array<(DashboardType & { type: 'dashboard' }) | (TableType & { type: 'table' })>>(() => {
  const entities = []

  if (!isSharedBase.value) {
    // Add dashboards with type identifier
    for (const dashboard of activeBaseDashboards.value) {
      entities.push({ ...dashboard, type: 'dashboard' as const })
    }
  }

  // Add tables from default source with type identifier
  if (base.value?.sources?.length && base.value?.sources?.[0]?.enabled) {
    const sourceId = base.value?.sources?.[0]?.id
    for (const table of tables.value) {
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
      if (children.length - 1 === newIndex) {
        // Item moved to last position
        item.order = (itemBefore?.order ?? 0) + 1
      } else if (newIndex === 0) {
        // Item moved to first position
        item.order = (itemAfter?.order ?? 1) / 2
      } else {
        // Item moved to middle position
        item.order = ((itemBefore?.order ?? 0) + (itemAfter?.order ?? 0)) / 2
      }

      // Update the allEntities array order to reflect the DOM change
      const entities = [...allEntities.value]
      const [movedEntity] = entities.splice(oldIndex, 1)
      movedEntity.order = item.order
      entities.splice(newIndex, 0, movedEntity)

      // force re-render the list
      if (keys.value.data) {
        keys.value.data = keys.value.data + 1
      } else {
        keys.value.data = 1
      }

      // Update backend based on item type
      if (item.type === 'dashboard') {
        const dashboards = activeBaseDashboards.value
        const dashboardIndex = dashboards.findIndex((d) => d.id === item.id)
        if (dashboardIndex !== -1) {
          dashboards[dashboardIndex].order = item.order
        }
        await dashboardStore.updateDashboard(baseId.value, item.id, {
          order: item.order,
        })
      } else if (item.type === 'table') {
        // Update local table order in the tables array
        const tables = baseTables.value.get(baseId.value)
        const tableIndex = tables.findIndex((t) => t.id === item.id)
        if (tableIndex !== -1) {
          tables[tableIndex].order = item.order
        }

        await $api.dbTable.reorder(item.id as string, {
          order: item.order,
        })
      }

      markItem(item.id)
      $e('a:data:reorder')
    },
    setData(dataTransfer, dragEl) {
      if (!dragEl?.dataset?.id) {
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

/**
 * Opens a dialog to create a new table.
 *
 * @returns {void}
 *
 * @remarks
 * This function is triggered when the user initiates the table creation process.
 * It opens a dialog for table creation, handles the dialog closure,
 * and potentially scrolls to the newly created table.
 *
 * @see {@link packages/nc-gui/components/smartsheet/topbar/TableListDropdown.vue} for a similar implementation
 * of table creation dialog. If this function is updated, consider updating the other implementation as well.
 */
function openTableCreateDialog() {
  const isOpen = ref(true)
  const sourceId = base.value!.sources?.[0].id

  if (!sourceId || !base.value?.id) return

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    sourceId,
    'baseId': base.value!.id,
    'onCreate': closeDialog,
    'showSourceSelector': false,
    'onUpdate:modelValue': () => closeDialog(),
  })

  function closeDialog(table?: TableType) {
    isOpen.value = false

    if (!table) return

    close(1000)
  }
}
watchEffect(() => {
  if (menuRef.value && isUIAllowed('viewCreateOrEdit')) {
    initSortable(menuRef.value)
  }
})
</script>

<template>
  <div>
    <div
      v-if="!allEntities.length && hasTableCreatePermission"
      class="nc-create-table-btn flex flex-row items-center cursor-pointer rounded-md w-full text-nc-content-brand hover:text-nc-content-brand-disabled"
      role="button"
      @click="openTableCreateDialog"
    >
      <div class="nc-project-home-section-item">
        <GeneralIcon icon="plus" />
        <div>
          {{
            $t('general.createEntity', {
              entity: $t('objects.table'),
            })
          }}
        </div>
      </div>
    </div>
    <div
      v-else-if="!allEntities.length && !hasTableCreatePermission"
      class="py-0.5 text-nc-content-gray-muted nc-project-home-section-item font-normal"
    >
      {{ $t('placeholder.noTables') }}
    </div>

    <div v-else ref="menuRef" :key="`data-${keys.data || 0}`" class="nc-data-menu flex flex-col w-full !border-r-0 !bg-inherit">
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
    @apply !bg-nc-bg-gray-medium;
  }

  .active {
    @apply !bg-primary-selected font-medium;
  }
}
</style>
