<script setup lang="ts">
import { type ColumnType, isAttachment, isBarcode, isButton, isLinksOrLTAR, isQrCode, isSystemColumn } from 'nocodb-sdk'
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:xAxis': [xAxis: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const selectedFieldId = ref(selectedWidget.value?.config?.data?.xAxis?.column_id)

const selectedSortValue = ref(selectedWidget.value?.config?.data?.xAxis?.sortBy || 'xAxis')

const selectedOrderValue = ref(selectedWidget.value?.config?.data?.xAxis?.orderBy || 'default')

const includeEmptyRecords = ref(selectedWidget.value?.config?.data?.xAxis?.includeEmptyRecords || false)

const includeOthers = ref(selectedWidget.value?.config?.data?.xAxis?.includeOthers || true)

const modelId = computed(() => selectedWidget.value?.fk_model_id || null)

const handleChange = (type: 'field' | 'sort' | 'order' | 'includeEmptyRecords') => {
  const xAxis = {
    includeEmptyRecords: includeEmptyRecords.value,
    includeOthers: includeOthers.value,
  }

  if (type === 'field') {
    xAxis.column_id = selectedFieldId.value
    xAxis.sortBy = 'xAxis'
    xAxis.orderBy = 'default'
  } else if (type === 'sort') {
    xAxis.sortBy = selectedSortValue.value
    xAxis.orderBy = selectedOrderValue.value
  } else if (type === 'order') {
    xAxis.orderBy = selectedOrderValue.value
    xAxis.sortBy = selectedSortValue.value
  }

  emit('update:xAxis', xAxis)
}

const fieldOrderOptions = [
  { value: 'default', label: 'Default field order' },
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]

const sortOrderOptions = [
  { value: 'xAxis', label: 'xAxis Value' },
  { value: 'yAxis', label: 'yAxis Value' },
]

const filterField = (column: ColumnType) => {
  if (
    isSystemColumn(column) ||
    isAttachment(column) ||
    isQrCode(column) ||
    isBarcode(column) ||
    isButton(column) ||
    isJSON(column) ||
    isLinksOrLTAR(column)
  ) {
    return false
  }
  return true
}
</script>

<template>
  <GroupedSettings title="X-axis">
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Field</label>
      <NcListColumnSelector
        v-model:value="selectedFieldId"
        disable-label
        :table-id="modelId"
        :filter-column="filterField"
        @update:value="handleChange('field')"
      />
    </div>

    <div class="flex gap-2 flex-1 min-w-0">
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Sort By</label>
        <a-select
          v-model:value="selectedSortValue"
          :options="sortOrderOptions"
          class="nc-select-shadow"
          placeholder="Sort by"
          @update:value="handleChange('sort')"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
        </a-select>
      </div>
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <label>Order</label>
        <a-select
          v-model:value="selectedOrderValue"
          :disabled="!selectedFieldId"
          :options="fieldOrderOptions"
          class="nc-select-shadow"
          placeholder="Order by"
          @update:value="handleChange('order')"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
        </a-select>
      </div>
    </div>

    <div>
      <NcSwitch v-model:checked="includeEmptyRecords" @change="handleChange('includeEmptyRecords')">
        <span class="text-caption text-nc-content-gray select-none">Include empty records</span>
      </NcSwitch>
    </div>
    <div class="flex items-center">
      <NcSwitch v-model:checked="includeOthers" class="flex items-center" @change="handleChange">
        <span class="text-caption text-nc-content-gray select-none">
          <NcTooltip class="flex items-center" hide-on-click>
            <template #title>
              By default the chart will show top 10 categories and remaining categories will be grouped as "Others". Disabling
              this will hide "Others" category.
            </template>
            Include others
          </NcTooltip>
        </span>
      </NcSwitch>
    </div>
  </GroupedSettings>
</template>
