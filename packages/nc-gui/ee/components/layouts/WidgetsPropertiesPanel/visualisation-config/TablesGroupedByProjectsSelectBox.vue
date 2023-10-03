<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select'
import type { DataSourceInternal } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { availableTablesOfAllDBProjectsLinkedWithDashboardProject, focusedWidget } = storeToRefs(dashboardStore)

const { changeSelectedProjectIdAndTableIdOfFocusedWidget } = dashboardStore

const tablesGroupedByProject = computed(() => {
  const tablesGroupedByProject: {
    [key: string]: { baseId: string; baseTitle: string; tables: { baseIdAndTableId: string; tableName: string }[] }
  } = {}
  availableTablesOfAllDBProjectsLinkedWithDashboardProject.value?.forEach((table) => {
    if (!tablesGroupedByProject[table.base.id]) {
      tablesGroupedByProject[table.base.id] = {
        baseId: table.base.id,
        baseTitle: table.base.title,
        tables: [],
      }
    }
    tablesGroupedByProject[table.base.id].tables.push({
      baseIdAndTableId: `${table.base.id}___${table.id}`,
      tableName: table.title,
    })
  })
  return tablesGroupedByProject
})

// TODO: support here also external data sources
const internalDataSource = computed(() => focusedWidget.value?.data_source as DataSourceInternal | undefined)

const handleChange = async (value: SelectValue) => {
  const [baseId, tableId] = ((value as string) || '').split('___')
  if (!baseId || !tableId) return
  await changeSelectedProjectIdAndTableIdOfFocusedWidget(baseId, tableId)
}

const selectedProjectIdAndTableId = computed(() => {
  const selectedProjectId = internalDataSource.value?.baseId
  const selectedTableId = internalDataSource.value?.tableId
  if (!selectedProjectId || !selectedTableId) return ''
  return `${selectedProjectId}___${selectedTableId}`
})

const allDataIsReady = computed(() => {
  return availableTablesOfAllDBProjectsLinkedWithDashboardProject.value
})
</script>

<template>
  <div class="nc-tables-grouped-by-bases-select-box-container">
    <a-select
      v-if="allDataIsReady"
      v-model:value="selectedProjectIdAndTableId"
      show-search
      class="nc-tables-grouped-by-bases-select-box"
      @change="handleChange"
    >
      <a-select-opt-group
        v-for="baseWithTables of tablesGroupedByProject"
        :key="baseWithTables.baseId"
        :value="baseWithTables.baseTitle"
      >
        <template #label>
          <span>
            {{ baseWithTables.baseTitle }}
          </span>
        </template>
        <a-select-option v-for="table of baseWithTables.tables" :key="table.baseIdAndTableId" :value="table.baseIdAndTableId">
          <div class="flex gap-1 items-center">
            {{ table.tableName }}
          </div>
        </a-select-option>
      </a-select-opt-group>
    </a-select>
  </div>
</template>

<style>
.nc-tables-grouped-by-bases-select-box {
  /* min-width: 10rem; */
  @apply flex-1 my-1 rounded-full;
}

.nc-tables-grouped-by-bases-select-box-container {
  /* margin-bottom: 1rem;
  display: flex;
  flex-direction: row; */
  @apply w-full flex pb-4;
}

:deep(.ant-select) {
  @apply rounded-full;
}
</style>
