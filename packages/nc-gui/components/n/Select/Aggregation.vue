<script setup lang="ts">
import { CommonAggregations, UITypes, getAvailableAggregations } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import type { NSelectProps } from './types'
const props = withDefaults(
  defineProps<NSelectProps & { tableId?: string; columnId?: string; filterOption?: (t: string) => boolean }>(),
  {
    placeholder: '- select aggregation -',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
}>()

const { getMeta } = useMetas()

const column = ref<ColumnType | null>(null)
const availableAggregations = ref<string[]>([])
const isLoading = ref(false)

const selectedAggregation = computed({
  get: () => props.modelValue || CommonAggregations.None,
  set: (value) => {
    emit('update:modelValue', value)
    emit('change', value)
  },
})

async function fetchColumnMetadata() {
  if (!props.tableId || !props.columnId) return

  try {
    isLoading.value = true

    const tableMeta = await getMeta(props.tableId)
    if (!tableMeta) {
      console.error('Failed to fetch table metadata')
      return
    }

    const columnMeta = tableMeta.columns?.find((col) => col.id === props.columnId)
    if (!columnMeta) {
      return
    }

    column.value = columnMeta

    if (columnMeta.uidt === UITypes.Formula && columnMeta.colOptions?.parsed_tree) {
      availableAggregations.value = getAvailableAggregations(columnMeta.uidt, columnMeta.colOptions.parsed_tree)
    } else {
      availableAggregations.value = getAvailableAggregations(columnMeta.uidt)
    }
  } catch (error) {
    console.error('Error fetching column metadata:', error)
  } finally {
    isLoading.value = false
    availableAggregations.value = availableAggregations.value.filter((agg) => agg !== CommonAggregations.None)
    if (props.filterOption) {
      availableAggregations.value = availableAggregations.value.filter(props.filterOption)
    }
  }
}

watchEffect(() => {
  fetchColumnMetadata()
})

defineExpose({
  availableAggregations,
})
</script>

<template>
  <a-select
    v-model:value="selectedAggregation"
    class="nc-select-shadow"
    :loading="isLoading"
    :disabled="isLoading || !availableAggregations.length"
    :placeholder="props.placeholder || '- select aggregation -'"
  >
    <template #suffixIcon>
      <GeneralIcon icon="arrowDown" class="text-gray-700" />
    </template>
    <a-select-option v-for="agg in availableAggregations" :key="agg" :value="agg">
      {{ $t(`aggregation_type.${agg}`) }}
    </a-select-option>
  </a-select>
</template>
