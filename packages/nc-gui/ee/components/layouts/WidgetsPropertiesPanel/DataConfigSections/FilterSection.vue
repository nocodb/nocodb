<script setup lang="ts">
import type { BaseType, DataSourceInternal, NumberWidget } from 'nocodb-sdk'
import useWidgetFilters from './useWidgetFilters'
import { ref } from '#imports'
import type { Filter } from '#imports'

interface Props {
  nested?: boolean
  parentId?: string
  hookId?: string
  showLoading?: boolean
  modelValue?: Filter[]
  webHook?: boolean
}

const { parentId } = defineProps<Props>()

const dashboardStore = useDashboardStore()
const { focusedWidget } = storeToRefs(dashboardStore)
const { changeSelectRecordsModeForNumberWidgetDataConfig } = dashboardStore

const { loadFilters } = useWidgetFilters(focusedWidget, parentId)

watch(
  () => focusedWidget?.value?.id,
  async (focusedWidgetId) => {
    if (focusedWidgetId) {
      await loadFilters()
    }
  },
  { immediate: true },
)

const { $api } = useNuxtApp()

const baseType = ref<BaseType>()

watch(
  () => (focusedWidget.value?.data_source as DataSourceInternal)?.tableId,
  async (widget) => {
    if (!widget) return
    const tableIdOfWidget = (focusedWidget.value?.data_source as DataSourceInternal).tableId
    const table = await $api.dbTable.read(tableIdOfWidget!)
    const base = await $api.base.read(table.project_id!, table.base_id!)
    baseType.value = base.type! as BaseType
  },
  { immediate: true },
)
const selectRecordsMode = computed(() => (focusedWidget.value as NumberWidget)?.data_config?.selectRecordsMode)
const visible = ref<boolean>(false)

const showModal = () => {
  visible.value = true
}

const handleOk = (e: MouseEvent) => {
  console.log(e)
  visible.value = false
}
</script>

<template>
  <div class="flex flex-col m-0">
    <div class="nc-dashboard-layouts-propspanel-selectable-config-section mb-2">
      <a-radio
        :checked="selectRecordsMode === 'all_records'"
        @change="changeSelectRecordsModeForNumberWidgetDataConfig('all_records')"
        ><h3>All records</h3></a-radio
      >
    </div>

    <div class="nc-dashboard-layouts-propspanel-selectable-config-section">
      <a-radio
        :checked="selectRecordsMode === 'specific_records'"
        @change="changeSelectRecordsModeForNumberWidgetDataConfig('specific_records')"
        ><h3>Specific records</h3></a-radio
      >
      <h4>Show records with conditions</h4>
      <div v-if="selectRecordsMode === 'specific_records'">
        <a-button type="primary" @click="showModal">Show filters</a-button>
        <a-modal v-model:visible="visible" title="Filters" @ok="handleOk">
          <LayoutsWidgetsPropertiesPanelDataConfigSectionsFilter />
        </a-modal>

        <slot />
      </div>
    </div>
  </div>
</template>
