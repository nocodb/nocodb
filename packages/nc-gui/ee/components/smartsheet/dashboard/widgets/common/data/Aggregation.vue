<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { AllAggregations, WidgetTypes, isSystemColumn } from 'nocodb-sdk'
import TabbedSelect from '../TabbedSelect.vue'

const emit = defineEmits<{
  'update:aggregation': [aggregation: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const selectedValue = ref(
  selectedWidget.value?.config?.metric?.type || selectedWidget.value?.config?.data?.value?.type || 'count',
)
const selectedAggregationType = ref(
  selectedWidget.value?.config?.metric?.aggregation || selectedWidget.value?.config?.data?.value?.aggregation,
)
const selectedFieldId = ref(
  selectedWidget.value?.config?.metric?.column_id || selectedWidget.value?.config?.data?.value?.column_id,
)

const modelId = computed(() => selectedWidget.value?.fk_model_id || null)

const aggregationMap = {
  count: 'Record Count',
  summary: 'Field Summary',
} as const

const handleChange = (type: 'field' | 'aggregation') => {
  const aggregation = {
    type: selectedValue.value,
  }
  if (type === 'field') {
    aggregation.aggregation = AllAggregations.CountUnique
    aggregation.column_id = selectedFieldId.value
    selectedAggregationType.value = AllAggregations.CountUnique
  }

  if (type === 'aggregation') {
    aggregation.column_id = selectedFieldId.value
    aggregation.aggregation = selectedAggregationType.value
  }

  emit('update:aggregation', aggregation)
}

const filterAggregation = (value: string) => {
  if (selectedWidget.value?.type === WidgetTypes.METRIC) {
    return true
  }
  return [
    AllAggregations.Sum,
    AllAggregations.Min,
    AllAggregations.Max,
    AllAggregations.Avg,
    AllAggregations.Median,
    AllAggregations.Count,
    AllAggregations.CountUnique,
    AllAggregations.Checked,
    AllAggregations.Unchecked,
    AllAggregations.DateRange,
    AllAggregations.MonthRange,
  ].includes(value as any)
}

const filterField = (column: ColumnType) => {
  if (
    isSystemColumn(column) ||
    isAttachment(column) ||
    isQrCode(column) ||
    isBarcode(column) ||
    isButton(column) ||
    isLookup(column)
  ) {
    return false
  }
  return true
}

watch(modelId, () => {
  selectedValue.value = 'count'
  selectedFieldId.value = null
  selectedAggregationType.value = null
})

watch(selectedValue, () => {
  const aggregation = {
    type: selectedValue.value,
  }
  selectedFieldId.value = null

  if (selectedValue.value === 'count') {
    aggregation.column_id = null
    aggregation.aggregation = null
    selectedAggregationType.value = 'count'
  } else if (selectedValue.value === 'summary') {
    selectedAggregationType.value = null
    aggregation.column_id = selectedFieldId.value
    aggregation.aggregation = selectedAggregationType.value
  }

  emit('update:aggregation', aggregation)
})
</script>

<template>
  <TabbedSelect v-model:model-value="selectedValue" :values="['count', 'summary']">
    <template #default="{ value }">
      {{ aggregationMap[value] }}
    </template>
  </TabbedSelect>

  <div v-if="selectedValue === 'summary'" class="flex gap-2 flex-1 min-w-0">
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Field</label>
      <NcListColumnSelector disable-label  :filter-column="filterField" v-model:value="selectedFieldId" :disabled="!modelId" :table-id="modelId!" @update:value="handleChange('field')" />
    </div>

    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Type</label>
      <NcListAggregationSelector disable-label :disabled="!modelId || !selectedFieldId" :filter-column="filterAggregation" v-model:value="selectedAggregationType" :column-id="selectedFieldId" :table-id="modelId" @update:value="handleChange('aggregation')" />
    </div>
  </div>
</template>
