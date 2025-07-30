<script setup lang="ts">
import { CommonAggregations, UITypes, getAvailableAggregations } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  tableId?: string
  columnId?: string
  value?: string
  showAggregationSelector?: boolean
  forceLayout?: 'vertical' | 'horizontal'
  filterAggregation?: (aggregation: string) => boolean
  forceLoadColumnMeta?: boolean
  disableLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showAggregationSelector: true,
  forceLoadColumnMeta: false,
  disableLabel: false,
})

const emit = defineEmits<{
  'update:value': [value: string | undefined]
}>()

const { t } = useI18n()

const { getMeta } = useMetas()

const modelValue = useVModel(props, 'value', emit)

const isOpenAggregationSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  const stringValue = String(value)
  modelValue.value = stringValue
  emit('update:value', stringValue)
}

const column = ref<ColumnType | null>(null)
const isLoading = ref(false)

const aggregationList = computedAsync(async () => {
  if (!props.tableId || !props.columnId) return []

  try {
    isLoading.value = true

    const tableMeta = await getMeta(props.tableId)
    if (!tableMeta) {
      console.error('Failed to fetch table metadata')
      return []
    }

    const columnMeta = tableMeta.columns?.find((col) => col.id === props.columnId)
    if (!columnMeta) {
      return []
    }

    column.value = columnMeta

    let availableAggregations: string[]
    if (columnMeta.uidt === UITypes.Formula && columnMeta.colOptions?.parsed_tree) {
      availableAggregations = getAvailableAggregations(columnMeta.uidt, columnMeta.colOptions.parsed_tree)
    } else {
      availableAggregations = getAvailableAggregations(columnMeta.uidt)
    }

    // Filter out None aggregation
    availableAggregations = availableAggregations.filter((agg) => agg !== CommonAggregations.None)
    
    // Apply custom filter if provided
    if (props.filterAggregation) {
      availableAggregations = availableAggregations.filter(props.filterAggregation)
    }

    return availableAggregations.map((agg) => {
      return {
        label: t(`aggregation_type.${agg}`),
        value: agg,
        ncItemDisabled: false,
        ncItemTooltip: '',
      }
    })
  } catch (error) {
    console.error('Error fetching column metadata:', error)
    return []
  } finally {
    isLoading.value = false
  }
}, [])

const selectedAggregation = computed(() => {
  if (!aggregationList.value || aggregationList.value.length === 0) return undefined

  return aggregationList.value.find((agg) => agg.value === modelValue.value) || aggregationList.value[0]
})

watch(aggregationList, (newAggregationList) => {
  if (!modelValue.value && newAggregationList && newAggregationList.length > 0) {
    const newAggregationValue = newAggregationList[0]?.value

    modelValue.value = newAggregationValue
  }
}, { immediate: true })

defineExpose({
  modelValue,
  selectedAggregation,
  isOpenAggregationSelectDropdown,
  aggregationList,
})
</script>

<template>
  <a-form-item
    name="aggregationId"
    class="!mb-0 nc-aggregation-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedAggregation?.ncItemDisabled ? 'error' : ''"
    :help="selectedAggregation?.ncItemDisabled ? [selectedAggregation.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>{{ t('general.aggregation') }}</div>
    </template>
    <NcListDropdown
      v-model:is-open="isOpenAggregationSelectDropdown"
      :disabled="!showAggregationSelector || isLoading"
      :default-slot-wrapper-class="
        !showAggregationSelector || isLoading
          ? 'text-nc-content-gray-muted cursor-not-allowed bg-nc-bg-gray-light children:opacity-60'
          : 'text-nc-content-gray'
      "
      :has-error="!!selectedAggregation?.ncItemDisabled"
    >
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <span :key="selectedAggregation?.value" class="text-sm flex-1 truncate">{{ selectedAggregation?.label || t('general.aggregation') }}</span>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenAggregationSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenAggregationSelectDropdown"
          :value="modelValue || selectedAggregation?.value || ''"
          :list="aggregationList"
          variant="medium"
          class="!w-auto !max-w-xs"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #item="{ item }">
            <div class="w-full flex items-center gap-2">
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ item.label }}</template>
                <span>{{ item.label }}</span>
              </NcTooltip>
              <component
                :is="iconMap.check"
                v-if="modelValue === item.value"
                id="nc-selected-item-icon"
                class="flex-none text-primary w-4 h-4"
              />
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>

<style lang="scss">
.nc-aggregation-selector.ant-form-item {
  &.nc-force-layout-vertical {
    @apply !flex-col;

    & > .ant-form-item-label {
      @apply pb-2 text-left;

      &::after {
        @apply hidden;
      }

      & > label {
        @apply !h-auto;
        &::after {
          @apply !hidden;
        }
      }
    }
  }

  &.nc-force-layout-horizontal {
    @apply !flex-row;

    & > .ant-form-item-label {
      @apply !w-auto !min-w-20 !flex-none;

      &::after {
        @apply hidden;
      }

      & > label {
        @apply !h-auto;
        &::after {
          @apply !hidden;
        }
      }
    }
  }
}
</style>
