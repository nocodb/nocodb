<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import {
  type ColumnType,
  type LinkToAnotherRecordType,
  RelationTypes,
  type RollupType,
  type TableType,
  UITypes,
} from 'nocodb-sdk'
import { getAvailableRollupForColumn, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { setAdditionalValidations, validateInfos, onDataTypeChange, isEdit, disableSubmitBtn, updateFieldName } =
  useColumnCreateStoreOrThrow()

const baseStore = useBase()

const { tables } = storeToRefs(baseStore)

const { metas, getMeta } = useMetas()

const { t } = useI18n()

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: t('general.required') }],
  fk_rollup_column_id: [{ required: true, message: t('general.required') }],
  rollup_function: [{ required: true, message: t('general.required') }],
})

if (!vModel.value.fk_relation_column_id) vModel.value.fk_relation_column_id = null
if (!vModel.value.fk_rollup_column_id) vModel.value.fk_rollup_column_id = null
if (!vModel.value.rollup_function) vModel.value.rollup_function = null

const refTables = computed(() => {
  if (!tables.value || !tables.value.length || !meta.value || !meta.value.columns) {
    return []
  }

  const _refTables = meta.value.columns
    .filter(
      (c: ColumnType) =>
        isLinksOrLTAR(c) &&
        (c.colOptions as LinkToAnotherRecordType).type &&
        ![RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(
          (c.colOptions as LinkToAnotherRecordType).type as RelationTypes,
        ) &&
        !c.system &&
        c.source_id === meta.value?.source_id,
    )
    .map((c: ColumnType) => ({
      col: c.colOptions,
      column: c,
      ...tables.value.find((t) => t.id === (c.colOptions as any)?.fk_related_model_id),
    }))
  return _refTables as Required<TableType & { column: ColumnType; col: Required<LinkToAnotherRecordType> }>[]
})

const selectedTable = computed(() => {
  return refTables.value.find((t) => t.column.id === vModel.value.fk_relation_column_id)
})

const columns = computed<ColumnType[]>(() => {
  if (!selectedTable.value?.id) {
    return []
  }

  return metas.value[selectedTable.value.id]?.columns.filter(
    (c: ColumnType) =>
      (!isVirtualCol(c.uidt as UITypes) || [UITypes.Formula].includes(c.uidt as UITypes)) && (!isSystemColumn(c) || c.pk),
  )
})

onMounted(() => {
  if (isEdit.value) {
    vModel.value.fk_relation_column_id = vModel.value.colOptions?.fk_relation_column_id
    vModel.value.fk_rollup_column_id = vModel.value.colOptions?.fk_rollup_column_id
    vModel.value.rollup_function = vModel.value.colOptions?.rollup_function
  }
})

const getNextColumnId = () => {
  const usedLookupColumnIds = (meta.value?.columns || [])
    .filter((c) => c.uidt === UITypes.Rollup)
    .map((c) => (c.colOptions as RollupType)?.fk_rollup_column_id)

  return columns.value.find((c) => !usedLookupColumnIds.includes(c.id))?.id
}

const onRelationColChange = async () => {
  if (selectedTable.value) {
    await getMeta(selectedTable.value.id)
  }
  vModel.value.fk_rollup_column_id = getNextColumnId() || columns.value?.[0]?.id
  onDataTypeChange()
}

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })

const aggFunctionsList: Ref<Record<string, string>[]> = ref([])

const allFunctions = [
  { text: t('datatype.Count'), value: 'count' },
  { text: t('general.min'), value: 'min' },
  { text: t('general.max'), value: 'max' },
  { text: t('general.avg'), value: 'avg' },
  { text: t('general.sum'), value: 'sum' },
  { text: t('general.countDistinct'), value: 'countDistinct' },
  { text: t('general.sumDistinct'), value: 'sumDistinct' },
  { text: t('general.avgDistinct'), value: 'avgDistinct' },
]

const availableRollupPerColumn = computed(() => {
  const fnMap: Record<string, { text: string; value: string }[]> = {}
  columns.value?.forEach((column) => {
    if (!column?.id) return
    fnMap[column.id] = allFunctions.filter((func) => getAvailableRollupForColumn(column).includes(func.value))
  })
  return fnMap
})

const filteredColumns = computed(() => {
  return columns.value?.filter((column) => {
    return column.id && availableRollupPerColumn.value[column.id as string]?.length
  })
})

const onRollupFunctionChange = () => {
  const rollupFun = aggFunctionsList.value.find((func) => func.value === vModel.value.rollup_function)
  if (rollupFun && rollupFun?.text) {
    vModel.value.rollup_function_name = rollupFun.text
  }
  onDataTypeChange()
  updateFieldName()
}

watch(
  () => vModel.value.fk_rollup_column_id,
  () => {
    const childFieldColumn = columns.value?.find((column: ColumnType) => column.id === vModel.value.fk_rollup_column_id)

    aggFunctionsList.value = availableRollupPerColumn.value[childFieldColumn?.id as string] || []

    if (aggFunctionsList.value.length && !aggFunctionsList.value.find((func) => func.value === vModel.value.rollup_function)) {
      // when the previous roll up function was numeric type and the current child field is non-numeric
      // reset rollup function with a non-numeric type
      vModel.value.rollup_function = aggFunctionsList.value[0].value
      vModel.value.rollup_function_name = aggFunctionsList.value[0].text
    }

    vModel.value.rollupColumnTitle = childFieldColumn?.title || childFieldColumn?.column_name

    updateFieldName()
  },
)

watchEffect(() => {
  if (!refTables.value.length) {
    disableSubmitBtn.value = true
  } else if (refTables.value.length && disableSubmitBtn.value) {
    disableSubmitBtn.value = false
  }
})

watch(
  () => vModel.value.fk_relation_column_id,
  (newValue) => {
    if (!newValue) return

    const selectedTable = refTables.value.find((t) => t.col.fk_column_id === newValue)
    if (selectedTable) {
      vModel.value.rollupTableTitle = selectedTable?.title || selectedTable.table_name
    }
  },
)

// update datatype precision when precision is less than the new value
// avoid downgrading precision if the new value is less than the current precision
// to avoid fractional part data loss(eg. 1.2345 -> 1.23)
const onPrecisionChange = (value: number) => {
  vModel.value.dtxs = Math.max(value, vModel.value.dtxs)
}

// set default value
vModel.value.meta = {
  ...columnDefaultMeta[UITypes.Rollup],
  ...(vModel.value.meta || {}),
}

const { isMetaReadOnly } = useRoles()

const precisionFormatsDisplay = makePrecisionFormatsDiplay(t)
</script>

<template>
  <div v-if="refTables.length" class="flex flex-col gap-4">
    <div class="w-full flex flex-row space-x-2">
      <a-form-item
        class="flex w-1/2 !max-w-[calc(50%_-_4px)] pb-2"
        :label="`${$t('general.link')} ${$t('objects.field')}`"
        v-bind="validateInfos.fk_relation_column_id"
      >
        <a-select
          v-model:value="vModel.fk_relation_column_id"
          placeholder="-select-"
          dropdown-class-name="!w-64 nc-dropdown-relation-table !rounded-md"
          @change="onRelationColChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
          <a-select-option v-for="(table, i) of refTables" :key="i" :value="table.col.fk_column_id">
            <div class="flex gap-2 w-full justify-between truncate items-center">
              <div class="min-w-1/2 flex items-center gap-2">
                <component :is="cellIcon(table.column)" :column-meta="table.column" class="!mx-0" />

                <NcTooltip class="truncate min-w-[calc(100%_-_24px)]" show-on-truncate-only>
                  <template #title>{{ table.column.title }}</template>
                  {{ table.column.title }}
                </NcTooltip>
              </div>
              <div class="inline-flex items-center truncate gap-2">
                <div class="text-[0.65rem] leading-4 flex-1 truncate text-gray-600 nc-relation-details">
                  <NcTooltip class="truncate" show-on-truncate-only>
                    <template #title>{{ table.title || table.table_name }}</template>
                    {{ table.title || table.table_name }}
                  </NcTooltip>
                </div>

                <component
                  :is="iconMap.check"
                  v-if="vModel.fk_relation_column_id === table.col.fk_column_id"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item
        class="flex w-1/2"
        :label="`${$t('datatype.Rollup')} ${$t('objects.field')}`"
        v-bind="vModel.fk_relation_column_id ? validateInfos.fk_rollup_column_id : undefined"
      >
        <a-select
          v-model:value="vModel.fk_rollup_column_id"
          name="fk_rollup_column_id"
          placeholder="-select-"
          :disabled="!vModel.fk_relation_column_id"
          show-search
          :filter-option="antSelectFilterOption"
          dropdown-class-name="nc-dropdown-relation-column !rounded-xl"
          @change="onDataTypeChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
          <a-select-option v-for="column of filteredColumns" :key="column.title" :value="column.id">
            <div class="w-full flex gap-2 truncate items-center justify-between">
              <div class="flex items-center gap-2 flex-1 truncate">
                <component :is="cellIcon(column)" :column-meta="column" class="!mx-0" />
                <div class="truncate flex-1">{{ column.title }}</div>
              </div>
              <component
                :is="iconMap.check"
                v-if="vModel.fk_rollup_column_id === column.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>

    <a-form-item
      :label="$t('labels.aggregateFunction')"
      v-bind="vModel.fk_relation_column_id ? validateInfos.rollup_function : undefined"
    >
      <a-select
        v-model:value="vModel.rollup_function"
        :disabled="!vModel.fk_relation_column_id"
        placeholder="-select-"
        dropdown-class-name="nc-dropdown-rollup-function"
        class="!mt-0.5"
        @change="onRollupFunctionChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-gray-700" />
        </template>
        <a-select-option v-for="(func, index) of aggFunctionsList" :key="index" :value="func.value">
          <div class="flex gap-2 justify-between items-center">
            {{ func.text }}
            <component
              :is="iconMap.check"
              v-if="vModel.rollup_function === func.value"
              id="nc-selected-item-icon"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item :label="$t('placeholder.precision')">
      <a-select
        v-if="vModel.meta?.precision || vModel.meta?.precision === 0"
        v-model:value="vModel.meta.precision"
        :disabled="isMetaReadOnly"
        dropdown-class-name="nc-dropdown-decimal-format"
        @change="onPrecisionChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-gray-700" />
        </template>
        <a-select-option v-for="(format, i) of precisionFormats" :key="i" :value="format">
          <div class="flex gap-2 w-full justify-between items-center">
            {{ (precisionFormatsDisplay as any)[format] }}
            <component
              :is="iconMap.check"
              v-if="vModel.meta.precision === format"
              id="nc-selected-item-icon"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item>
      <div class="flex items-center gap-1">
        <NcSwitch v-if="vModel.meta" v-model:checked="vModel.meta.isLocaleString">
          <div class="text-sm text-gray-800 select-none">{{ $t('labels.showThousandsSeparator') }}</div>
        </NcSwitch>
      </div>
    </a-form-item>
  </div>
  <div v-else>
    <a-alert type="warning" show-icon>
      <template #icon><GeneralIcon icon="alertTriangle" class="h-6 w-6" width="24" height="24" /></template>
      <template #message> Alert </template>
      <template #description>
        {{
          $t('msg.linkColumnClearNotSupportedYet', {
            type: 'Rollup',
          })
        }}
      </template>
    </a-alert>
  </div>
</template>

<style scoped>
:deep(.ant-select-selector .ant-select-selection-item .nc-relation-details) {
  @apply hidden;
}
</style>
