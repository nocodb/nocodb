<script setup lang="ts">
import type { NumberWidget } from 'nocodb-sdk'
import { availableAggregateFunctionsWithIdAndTitle } from '~~/store/dashboard'
const dashboardStore = useDashboardStore()
const { changeAggregateFunctionOfFocusedWidget, changeSelectedNumberColumnIdOfFocusedWidget } = dashboardStore

const { focusedWidget, availableNumericColumnsOfSelectedView } = storeToRefs(dashboardStore)

const numberWidget = computed(() => focusedWidget.value as NumberWidget | undefined)
const activeSection = ref<number>(1)

const availableColumnsOfSelectedViewWithTitles = computed(() => {
  return availableNumericColumnsOfSelectedView.value?.map((column) => ({
    id: column.id,
    title: column.column_name,
  }))
})

const changeActiveSection = (section: number) => {
  activeSection.value = section
}
</script>

<template>
  <a-collapse expand-icon-position="right" accordion :bordered="false" class="collapse-panel-custom">
    <a-collapse-panel class="nc-collapse-panel" header="Step 1: Select Table and View">
      <LayoutsWidgetsPropertiesPanelProjectTableViewSelectorSection />
    </a-collapse-panel>
    <a-collapse-panel class="nc-collapse-panel" header="Step 2: Select Records">
      <div><LayoutsWidgetsPropertiesPanelDataConfigSectionsFilter /></div>
    </a-collapse-panel>
    <a-collapse-panel class="nc-collapse-panel !rounded-lg" header="Step 3: Rollup function">
      <div class="flex flex-col m-0">
        <div class="bg-gray-100 rounded-lg p-2 mb-2">
          <a-radio :checked="activeSection === 1" @change="changeActiveSection(1)"><h3>Record count</h3></a-radio>
          <h3 class="text-gray-500">Number of records in the table</h3>
          <div v-if="activeSection === 1"></div>
        </div>

        <div class="bg-gray-100 rounded-lg p-2">
          <a-radio :checked="activeSection === 2" @change="changeActiveSection(2)"><h3>Field summary</h3></a-radio>
          <h3 class="text-gray-500">Number of records in the table, from:</h3>
          <div v-if="activeSection === 2">
            <div class="flex justify-between items-center mb-2">
              <label for="field">Field</label>
              <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
                id="field"
                v-model="numberWidget.data_config.colId"
                :id-and-title-tuple-list="availableColumnsOfSelectedViewWithTitles"
                @change-selected-value="changeSelectedNumberColumnIdOfFocusedWidget($event)"
              />
            </div>
            <div class="flex justify-between items-center">
              <label for="summarize">Summarize</label>
              <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
                id="summarize"
                v-model="numberWidget.data_config.aggregateFunction"
                :id-and-title-tuple-list="availableAggregateFunctionsWithIdAndTitle"
                @change-selected-value="changeAggregateFunctionOfFocusedWidget($event)"
              />
            </div>
          </div>
        </div>
      </div>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped lang="scss">
.nc-collapse-panel {
  @apply border border-solid border-grey-light rounded-lg my-2;
}

.collapse-panel-custom {
  background-color: transparent;
}
:deep(.ant-collapse-content-box) {
}

:deep(.ant-radio-wrapper) {
  @apply m-0 mb-2;
}
</style>
