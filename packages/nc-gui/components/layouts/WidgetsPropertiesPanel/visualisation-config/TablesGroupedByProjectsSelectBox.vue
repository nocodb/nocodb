<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select'
import type { DataSourceInternal } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { availableTablesOfAllDBProjectsLinkedWithDashboardProject, focusedWidget } = storeToRefs(dashboardStore)

const { changeSelectedProjectIdAndTableIdOfFocusedWidget } = dashboardStore

const tablesGroupedByProject = computed(() => {
  const tablesGroupedByProject: {
    [key: string]: { projectId: string; projectTitle: string; tables: { projectIdAndTableId: string; tableName: string }[] }
  } = {}
  availableTablesOfAllDBProjectsLinkedWithDashboardProject.value?.forEach((table) => {
    if (!tablesGroupedByProject[table.project.id]) {
      tablesGroupedByProject[table.project.id] = {
        projectId: table.project.id,
        projectTitle: table.project.title,
        tables: [],
      }
    }
    tablesGroupedByProject[table.project.id].tables.push({
      projectIdAndTableId: `${table.project.id}___${table.id}`,
      tableName: table.title,
    })
  })
  return tablesGroupedByProject
})

// TODO: support here also external data sources
const internalDataSource = computed(() => focusedWidget.value?.data_source as DataSourceInternal | undefined)

const handleChange = async (value: SelectValue) => {
  const [projectId, tableId] = ((value as string) || '').split('___')
  if (!projectId || !tableId) return
  await changeSelectedProjectIdAndTableIdOfFocusedWidget(projectId, tableId)
}

const selectedProjectIdAndTableId = computed(() => {
  const selectedProjectId = internalDataSource.value?.projectId
  const selectedTableId = internalDataSource.value?.tableId
  if (!selectedProjectId || !selectedTableId) return ''
  return `${selectedProjectId}___${selectedTableId}`
})

const allDataIsReady = computed(() => {
  return availableTablesOfAllDBProjectsLinkedWithDashboardProject.value
})
</script>

<template>
  <div class="nc-tables-grouped-by-projects-select-box-container">
    <label class="nc-tables-grouped-by-projects-select-box-label">Table</label>
    <a-select
      v-if="allDataIsReady"
      :value="selectedProjectIdAndTableId"
      class="nc-tables-grouped-by-projects-select-box"
      @change="handleChange"
    >
      <a-select-opt-group
        v-for="projectWithTables of tablesGroupedByProject"
        :key="projectWithTables.projectId"
        :value="projectWithTables.projectTitle"
      >
        <template #label>
          <span>
            {{ projectWithTables.projectTitle }}
          </span>
        </template>
        <a-select-option
          v-for="table of projectWithTables.tables"
          :key="table.projectIdAndTableId"
          :value="table.projectIdAndTableId"
        >
          <div class="flex gap-1 items-center">
            {{ table.tableName }}
          </div>
        </a-select-option>
      </a-select-opt-group>
    </a-select>
  </div>
</template>

<style>
.nc-tables-grouped-by-projects-select-box {
  min-width: 10rem;
}

.nc-tables-grouped-by-projects-select-box-label {
  min-width: 5rem;
}

.nc-tables-grouped-by-projects-select-box-container {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: row;
}
</style>
