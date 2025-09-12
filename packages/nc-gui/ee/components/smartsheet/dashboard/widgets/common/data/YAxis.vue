<script setup lang="ts">
import {
  CommonAggregations,
  getAvailableAggregations,
  isAttachment,
  isBarcode,
  isButton,
  isLinksOrLTAR,
  isQrCode,
  isSystemColumn,
} from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:yAxis': [yAxis: any]
}>()

const { getMeta } = useMetas()

const { t } = useI18n()

const { selectedWidget } = storeToRefs(useWidgetStore())

const fieldConfigurations = ref(selectedWidget.value?.config?.data?.yAxis?.fields || [])

const groupByField = ref(selectedWidget.value?.config?.data?.yAxis?.groupBy || null)

const startAtZero = ref(selectedWidget.value?.config?.data?.yAxis?.startAtZero || true)

const fieldDropdownStates = ref<boolean[]>([])

const aggregationDropdownStates = ref<boolean[]>([])

const modelId = computed(() => selectedWidget.value?.fk_model_id || null)

const tableMeta = ref<any>(null)

const _filterField = (column: ColumnType) => {
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

watch(
  modelId,
  async () => {
    if (modelId.value) {
      tableMeta.value = await getMeta(modelId.value)
    }
  },
  { immediate: true },
)

const columnOptions = computed(() => {
  if (!tableMeta.value?.columns) return []
  return tableMeta.value.columns
    .filter(
      (col: ColumnType) =>
        !isSystemColumn(col) &&
        !isLinksOrLTAR(col) &&
        !isBarcode(col) &&
        !isQrCode(col) &&
        !isAttachment(col) &&
        !isLookup(col) &&
        !isButton(col),
    )
    .map((col: ColumnType) => ({
      label: col.title,
      value: col.id,
      ...col,
    }))
})

// Aggregation options for dropdowns
const getAggregationOptions = (columnId: string) => {
  if (!columnId || !tableMeta.value?.columns) return []

  const column = tableMeta.value.columns.find((col: ColumnType) => col.id === columnId)
  if (!column) return []

  const availableAggregations = getAvailableAggregations(column.uidt!)

  return availableAggregations
    .filter((agg) => agg !== CommonAggregations.None)
    .map((agg) => ({
      label: t(`aggregation_type.${agg}`),
      value: agg,
    }))
}

const getSelectedColumn = (columnId: string) => {
  if (!columnId) return null
  return columnOptions.value.find((col) => col.value === columnId) || null
}

const handleChange = () => {
  emit('update:yAxis', {
    fields: fieldConfigurations.value,
    groupBy: groupByField.value,
    startAtZero: startAtZero.value,
  })
}

const updateField = (index: number, property: 'column_id' | 'aggregation', value: string) => {
  if (fieldConfigurations.value[index]) {
    fieldConfigurations.value[index][property] = value

    // If column changed, update aggregation to first available for new column
    if (property === 'column_id') {
      const availableAggregations = getAggregationOptions(value)
      fieldConfigurations.value[index].aggregation = availableAggregations.length > 0 ? availableAggregations[0].value : 'count'
    }

    // Close the dropdown
    if (property === 'column_id') {
      fieldDropdownStates.value[index] = false
    } else {
      aggregationDropdownStates.value[index] = false
    }

    // Emit the change
    handleChange()
  }
}

const addField = () => {
  const defaultColumnId = columnOptions.value.length > 0 ? columnOptions.value[0].value : null

  let defaultAggregation = 'count'
  if (defaultColumnId) {
    const availableAggregations = getAggregationOptions(defaultColumnId)
    defaultAggregation = availableAggregations.length > 0 ? availableAggregations[0].value : 'count'
  }

  fieldConfigurations.value.push({
    column_id: defaultColumnId,
    aggregation: defaultAggregation,
  })
  handleChange()
}

const removeField = (index: number) => {
  if (fieldConfigurations.value.length > 1) {
    fieldConfigurations.value.splice(index, 1)
    handleChange()
  }
}

watch(
  fieldConfigurations,
  (newConfigs) => {
    fieldDropdownStates.value = new Array(newConfigs.length).fill(false)
    aggregationDropdownStates.value = new Array(newConfigs.length).fill(false)
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <GroupedSettings title="Y-axis">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-700">Fields</label>
      <div class="flex flex-col border-nc-border-grey-medium border-1 rounded-lg overflow-hidden">
        <div
          v-for="(field, index) in fieldConfigurations"
          :key="index"
          class="flex items-center gap-2 px-1.5 py-2 h-8 border-b border-nc-border-grey-medium"
        >
          <!-- Field Selector -->
          <div class="flex-1 min-w-0">
            <NcDropdown v-model:visible="fieldDropdownStates[index]">
              <div class="flex-1 flex items-center gap-2 min-w-0 cursor-pointer">
                <SmartsheetHeaderIcon
                  v-if="getSelectedColumn(field.column_id)"
                  :column="getSelectedColumn(field.column_id)"
                  color="text-nc-content-gray-muted"
                />
                <NcTooltip hide-on-click class="truncate flex-1" show-on-truncate-only>
                  <span v-if="getSelectedColumn(field.column_id)" class="text-sm flex-1 truncate text-nc-content-gray-default">
                    {{ getSelectedColumn(field.column_id)?.label }}
                  </span>
                  <span v-else class="text-sm flex-1 truncate text-nc-content-gray-muted">-- Select field --</span>
                  <template #title>
                    {{ getSelectedColumn(field.column_id)?.label || 'Select field' }}
                  </template>
                </NcTooltip>
                <GeneralIcon
                  icon="ncChevronDown"
                  class="flex-none h-4 w-4 transition-transform opacity-70"
                  :class="{ 'transform rotate-180': fieldDropdownStates[index] }"
                />
              </div>
              <template #overlay>
                <NcList
                  v-model:open="fieldDropdownStates[index]"
                  :value="field.column_id || ''"
                  :list="columnOptions"
                  variant="medium"
                  class="!w-auto"
                  wrapper-class-name="!h-auto"
                  @update:value="updateField(index, 'column_id', $event)"
                >
                  <template #item="{ item }">
                    <div class="w-full flex items-center gap-2">
                      <SmartsheetHeaderIcon :column="item" color="text-nc-content-gray-muted" />

                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ item.label }}</template>
                        <span>{{ item.label }}</span>
                      </NcTooltip>

                      <component
                        :is="iconMap.check"
                        v-if="field.column_id === item.value"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </template>
                </NcList>
              </template>
            </NcDropdown>
          </div>

          <!-- Aggregation Selector -->
          <div class="flex-1 min-w-0">
            <NcDropdown v-model:visible="aggregationDropdownStates[index]">
              <div class="flex-1 flex items-center gap-2 min-w-0 cursor-pointer">
                <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
                  <span class="text-sm flex-1 truncate text-nc-content-gray-default">
                    {{ getAggregationOptions(field.column_id).find((agg) => agg.value === field.aggregation)?.label }}
                  </span>
                  <template #title>
                    {{ getAggregationOptions(field.column_id).find((agg) => agg.value === field.aggregation)?.label }}
                  </template>
                </NcTooltip>
                <GeneralIcon
                  icon="ncChevronDown"
                  class="flex-none h-4 w-4 transition-transform opacity-70"
                  :class="{ 'transform rotate-180': aggregationDropdownStates[index] }"
                />
              </div>
              <template #overlay>
                <NcList
                  v-model:open="aggregationDropdownStates[index]"
                  :value="field.aggregation || 'count'"
                  :list="getAggregationOptions(field.column_id)"
                  variant="medium"
                  class="!w-auto"
                  wrapper-class-name="!h-auto"
                  @update:value="updateField(index, 'aggregation', $event)"
                >
                  <template #item="{ item }">
                    <div class="w-full flex items-center gap-2">
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ item.label }}</template>
                        <span>{{ item.label }}</span>
                      </NcTooltip>
                      <component
                        :is="iconMap.check"
                        v-if="(field.aggregation || 'count') === item.value"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </template>
                </NcList>
              </template>
            </NcDropdown>
          </div>

          <!-- Remove Button -->
          <div class="flex-shrink-0">
            <NcButton
              v-if="fieldConfigurations.length > 1"
              size="xsmall"
              type="text"
              class="!w-6 !h-6"
              @click="removeField(index)"
            >
              <GeneralIcon icon="ncTrash2" class="w-4 h-4" />
            </NcButton>
          </div>
        </div>
        <div
          class="flex items-center gap-2 px-2 py-1.5 text-nc-content-brand text-sm cursor-pointer hover:bg-nc-bg-gray-light rounded-b-lg"
          @click="addField"
        >
          <GeneralIcon icon="ncPlus" class="w-4 h-4" />
          Add Field
        </div>
      </div>
    </div>

    <div>
      <NcSwitch v-model:checked="startAtZero" @change="handleChange()">
        <span class="text-caption text-nc-content-gray select-none">Start at zero</span>
      </NcSwitch>
    </div>

    <!-- Group by Field Section - TBD
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Group by field</label>
      <NcListColumnSelector
        v-model:value="groupByField"
        :allow-clear="true"
        disable-label
        :filter-column="_filterField"
        :disabled="!modelId"
        :table-id="modelId"
        @update:value="handleChange"
      />

    </div>
     -->
  </GroupedSettings>
</template>
