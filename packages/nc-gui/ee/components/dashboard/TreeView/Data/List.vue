<script setup lang="ts">
import type Sortable from 'sortablejs'
import { type DashboardType, ModelTypes } from 'nocodb-sdk'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { $e } = useNuxtApp()

const { t } = useI18n()

const { addUndo, defineModelScope } = useUndoRedo()

const dashboardStore = useDashboardStore()

const { activeTables } = storeToRefs(useTablesStore())

const { activeDashboardId, activeBaseDashboards } = storeToRefs(dashboardStore)

const { updateDashboard } = dashboardStore

const base = inject(ProjectInj)!

let sortable: Sortable

const selected = ref<string[]>([])

const dragging = ref(false)

const isMarked = ref<string | false>(false)

const allEntities = computed<Array<any>>(() => {
  const entities = []
  for (const dashboard of activeBaseDashboards.value) {
    entities.push(dashboard)
  }

  if (base.value?.sources?.length && base.value?.sources?.[0]?.enabled) {
    const sourceId = base.value?.sources?.[0]?.id
    for (const table of activeTables.value) {
      if (table.source_id !== sourceId) continue
      entities.push(table)
    }
  }

  return entities.sort((a, b) => a.order - b.order)
})

async function onRenameDashboard(dashboard: DashboardType, originalTitle?: string, undo = false) {
  try {
    await updateDashboard(dashboard.base_id, dashboard.id!, {
      title: dashboard.title,
      order: dashboard.order,
    })

    if (!undo) {
      addUndo({
        redo: {
          fn: (s: DashboardType, title: string) => {
            const tempTitle = s.title
            s.title = title
            onRenameDashboard(s, tempTitle, true)
          },
          args: [dashboard, dashboard.title],
        },
        undo: {
          fn: (s: DashboardType, title: string) => {
            const tempTitle = s.title
            s.title = title
            onRenameDashboard(s, tempTitle, true)
          },
          args: [dashboard, originalTitle],
        },
        scope: defineModelScope({ base_id: dashboard.base_id }),
      })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const updateDashboardIcon = async (icon: string, dashboard: DashboardType) => {
  try {
    // modify the icon property in meta
    dashboard.meta = {
      ...parseProp(dashboard.meta),
      icon,
    }

    await updateDashboard(dashboard.base_id, dashboard.id!, {
      meta: dashboard.meta,
    })

    $e('a:dashboard:icon:sidebar', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Open delete modal for dashboard */
function onDeleteDashboard(dashboard: DashboardType) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgDashboardDelete'), {
    'visible': isOpen,
    'dashboard': dashboard,
    'onUpdate:visible': closeDialog,
    'onDeleted': () => {
      closeDialog()
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const duplicateDashboard = async (dashboard: DashboardType) => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgDashboardDuplicate'), {
    'modelValue': isOpen,
    'dashboard': dashboard,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': () => {
      closeDialog()
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

/** validate dashboard title */
function validateDashboardTitle(dashboard: DashboardType) {
  if (!dashboard.title || dashboard.title.trim().length < 0) {
    return t('msg.error.dashboardNameRequired')
  }

  if (activeBaseDashboards.value.some((s) => s.title === dashboard.title && s.id !== dashboard.id)) {
    return t('msg.error.dashboardNameDuplicate')
  }

  return true
}
</script>

<template>
  <a-menu
    ref="menuRef"
    :class="{ dragging }"
    :selected-keys="selected"
    class="nc-data-menu flex flex-col w-full !border-r-0 !bg-inherit"
  >
    <template v-for="entity of allEntities" :key="entity.id">
      <DashboardTreeViewDashboardNode
        v-if="entity.type === ModelTypes.DASHBOARD"
        :id="entity.id"
        class="nc-dashboard-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
        :class="{
          'bg-gray-200': isMarked === entity.id,
          'active': activeDashboardId === entity.id,
        }"
        :on-validate="validateDashboardTitle"
        :dashboard="entity"
        @rename="onRenameDashboard(entity)"
        @delete="onDeleteDashboard(entity)"
        @select-icon="updateDashboardIcon($event, entity)"
        @duplicate="duplicateDashboard(entity)"
      />
      <DashboardTreeViewTableNode
        v-else
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
    <DashboardTreeViewDataSourceList :base-id="baseId" />
  </a-menu>
</template>

<style lang="scss">
.nc-data-menu {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  &.dragging {
    .nc-icon {
      @apply !hidden;
    }

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
