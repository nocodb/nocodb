<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, TableType, UITypes } from 'nocodb-sdk'
import { isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { MetaInj, inject, ref, storeToRefs, useBase, useColumnCreateStoreOrThrow, useMetas, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { setAdditionalValidations, validateInfos, onDataTypeChange, isEdit } = useColumnCreateStoreOrThrow()

const baseStore = useBase()
const { tables } = storeToRefs(baseStore)

const { metas } = useMetas()

const { t } = useI18n()

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: t('general.required') }],
  fk_rollup_column_id: [{ required: true, message: t('general.required') }],
  rollup_function: [{ required: true, message: t('general.required') }],
})

const aggrFunctionsList = [
  { text: t('datatype.Count'), value: 'count' },
  { text: t('general.min'), value: 'min' },
  { text: t('general.max'), value: 'max' },
  { text: t('general.avg'), value: 'avg' },
  { text: t('general.sum'), value: 'sum' },
  { text: t('general.countDistinct'), value: 'countDistinct' },
  { text: t('general.sumDistinct'), value: 'sumDistinct' },
  { text: t('general.avgDistinct'), value: 'avgDistinct' },
]

if (!vModel.value.fk_relation_column_id) vModel.value.fk_relation_column_id = null
if (!vModel.value.fk_rollup_column_id) vModel.value.fk_rollup_column_id = null
if (!vModel.value.rollup_function) vModel.value.rollup_function = null

const refTables = computed(() => {
  if (!tables.value || !tables.value.length || !meta.value || !meta.value.columns) {
    return []
  }

  const _refTables = meta.value.columns
    .filter(
      (c) =>
        isLinksOrLTAR(c) &&
        (c.colOptions as LinkToAnotherRecordType).type !== 'bt' &&
        !c.system &&
        c.source_id === meta.value?.source_id,
    )
    .map((c) => ({
      col: c.colOptions,
      column: c,
      ...tables.value.find((t) => t.id === (c.colOptions as any)?.fk_related_model_id),
    }))
  return _refTables as Required<TableType & { column: ColumnType; col: Required<LinkToAnotherRecordType> }>[]
})

const columns = computed(() => {
  const selectedTable = refTables.value.find((t) => t.column.id === vModel.value.fk_relation_column_id)

  if (!selectedTable?.id) {
    return []
  }

  return metas.value[selectedTable.id].columns.filter(
    (c: ColumnType) => !isVirtualCol(c.uidt as UITypes) && (!isSystemColumn(c) || c.pk),
  )
})

onMounted(() => {
  if (isEdit.value) {
    vModel.value.fk_relation_column_id = vModel.value.colOptions?.fk_relation_column_id
    vModel.value.fk_rollup_column_id = vModel.value.colOptions?.fk_rollup_column_id
    vModel.value.rollup_function = vModel.value.colOptions?.rollup_function
  }
})

const onRelationColChange = () => {
  vModel.value.fk_rollup_column_id = columns.value?.[0]?.id
  onDataTypeChange()
}

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })
</script>

<template>
  <div class="p-6 w-full flex flex-col border-2 mb-2 mt-4">
    <div class="w-full flex flex-row space-x-2">
      <a-form-item class="flex w-1/2 pb-2" :label="$t('labels.links')" v-bind="validateInfos.fk_relation_column_id">
        <a-select
          v-model:value="vModel.fk_relation_column_id"
          dropdown-class-name="!w-64 nc-dropdown-relation-table"
          @change="onRelationColChange"
        >
          <a-select-option v-for="(table, i) of refTables" :key="i" :value="table.col.fk_column_id">
            <div class="flex flex-row h-full pb-0.5 items-center max-w-full">
              <div class="font-semibold text-xs flex-shrink flex-grow-0 truncate">{{ table.column.title }}</div>
              <div class="flex-grow"></div>
              <div class="text-[0.65rem] text-gray-600 nc-relation-details">
                <span class="uppercase">{{ table.col.type }}</span> {{ table.title || table.table_name }}
              </div>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item class="flex w-1/2" :label="$t('labels.childColumn')" v-bind="validateInfos.fk_rollup_column_id">
        <a-select
          v-model:value="vModel.fk_rollup_column_id"
          name="fk_rollup_column_id"
          dropdown-class-name="nc-dropdown-relation-column"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="(column, index) of columns" :key="index" :value="column.id">
            <div class="flex items-center -ml-1 font-semibold text-xs">
              <component :is="cellIcon(column)" :column-meta="column" />

              {{ column.title }}
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>

    <a-form-item :label="$t('labels.aggregateFunction')" v-bind="validateInfos.rollup_function">
      <a-select
        v-model:value="vModel.rollup_function"
        dropdown-class-name="nc-dropdown-rollup-function"
        @change="onDataTypeChange"
      >
        <a-select-option v-for="(func, index) of aggrFunctionsList" :key="index" :value="func.value">
          {{ func.text }}
        </a-select-option>
      </a-select>
    </a-form-item>
  </div>
</template>

<style scoped>
:deep(.ant-select-selector .ant-select-selection-item .nc-relation-details) {
  @apply hidden;
}
</style>
