<script setup lang="ts">
import TabbedSelect from '../TabbedSelect.vue'

const emit = defineEmits<{
  'update:aggregation': [aggregation: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const selectedValue = ref(selectedWidget.value?.config?.metric?.aggregation === 'count' ? 'count' : 'summary')
const selectedAggregationType = ref(selectedWidget.value?.config?.metric?.aggregation || 'count')
const selectedFieldId = ref(selectedWidget.value?.config?.metric?.column_id || '')

const modelId = computed(() => selectedWidget.value?.config?.dataSource?.fk_model_id || '')

const aggregationMap = {
  count: 'Record Count',
  summary: 'Field Summary',
} as const

const aggregationOptions = [
  { value: 'distinct', label: 'Distinct' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'median', label: 'Median' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
]

const handleChange = (type: 'field' | 'aggregation') => {
  const aggregation = {
    type: selectedValue.value,
  }
  if (type === 'field') {
    aggregation.aggregation = null
  }

  if (type === 'aggregation') {
    aggregation.column_id = selectedFieldId.value
    aggregation.aggregation = selectedAggregationType.value
  }

  emit('update:aggregation', aggregation)
}

watch(selectedValue, () => {
  const aggregation = {
    aggregation: selectedValue.value,
  }
  if (selectedValue.value === 'count') {
    aggregation.column_id = null
    aggregation.aggregation = null
  } else if (selectedValue.value === 'summary') {
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
      <NSelectField v-model:value="selectedFieldId" v-model:table-id="modelId" @update:value="handleChange('field')" />
    </div>

    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Type</label>
      <a-select
        v-model:value="selectedAggregationType"
        :options="aggregationOptions"
        class="nc-select-shadow"
        @update:value="handleChange('aggregation')"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-gray-700" />
        </template>
      </a-select>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
