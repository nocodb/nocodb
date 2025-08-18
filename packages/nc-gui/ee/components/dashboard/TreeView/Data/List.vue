<script setup lang="ts">
import type Sortable from 'sortablejs'
import { ModelTypes } from 'nocodb-sdk'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const dashboardStore = useDashboardStore()

const { activeTables } = storeToRefs(useTablesStore())

const { activeDashboardId, activeBaseDashboards } = storeToRefs(dashboardStore)

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
        class="nc-dashboard-item nc-tree-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
        :class="{
          'bg-gray-200': isMarked === entity.id,
          'active': activeDashboardId === entity.id,
        }"
        :dashboard="entity"
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
