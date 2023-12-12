<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { MetaInj, inject, ref, storeToRefs, useBase, useColumnCreateStoreOrThrow, useI18n, useMetas, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const { setAdditionalValidations, validateInfos, onDataTypeChange, isEdit } = useColumnCreateStoreOrThrow()

const baseStore = useBase()

const { tables } = storeToRefs(baseStore)

const { metas } = useMetas()

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: t('general.required') }],
  fk_lookup_column_id: [{ required: true, message: t('general.required') }],
})

if (!vModel.value.fk_relation_column_id) vModel.value.fk_relation_column_id = null
if (!vModel.value.fk_lookup_column_id) vModel.value.fk_lookup_column_id = null

const refTables = computed(() => {
  if (!tables.value || !tables.value.length || !meta.value || !meta.value.columns) {
    return []
  }

  const _refTables = meta.value.columns
    .filter((column) => isLinksOrLTAR(column) && !column.system && column.source_id === meta.value?.source_id)
    .map((column) => ({
      col: column.colOptions,
      column,
      ...tables.value.find((table) => table.id === (column.colOptions as LinkToAnotherRecordType).fk_related_model_id),
    }))
    .filter((table) => (table.col as LinkToAnotherRecordType)?.fk_related_model_id === table.id && !table.mm)
  return _refTables as Required<TableType & { column: ColumnType; col: Required<LinkToAnotherRecordType> }>[]
})

const columns = computed<ColumnType[]>(() => {
  const selectedTable = refTables.value.find((t) => t.column.id === vModel.value.fk_relation_column_id)
  if (!selectedTable?.id) {
    return []
  }
  return metas.value[selectedTable.id].columns.filter(
    (c: ColumnType) =>
      vModel.value.fk_lookup_column_id === c.id || (!isSystemColumn(c) && c.id !== vModel.value.id && c.uidt !== UITypes.Links),
  )
})

onMounted(() => {
  if (isEdit.value) {
    vModel.value.fk_lookup_column_id = vModel.value.colOptions?.fk_lookup_column_id
    vModel.value.fk_relation_column_id = vModel.value.colOptions?.fk_relation_column_id
  }
})

const onRelationColChange = () => {
  vModel.value.fk_lookup_column_id = columns.value?.[0]?.id
  onDataTypeChange()
}

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })
</script>

<template>
  <div class="p-6 w-full flex flex-col border-2 mb-2 mt-4">
    <div v-if="refTables.length" class="w-full flex flex-row space-x-2">
      <a-form-item class="flex w-1/2 pb-2" :label="$t('labels.links')" v-bind="validateInfos.fk_relation_column_id">
        <a-select
          v-model:value="vModel.fk_relation_column_id"
          dropdown-class-name="!w-64 !rounded-md nc-dropdown-relation-table"
          @change="onRelationColChange"
        >
          <a-select-option v-for="(table, i) of refTables" :key="i" :value="table.col.fk_column_id">
            <div class="flex gap-2 w-full justify-between truncate items-center">
              <NcTooltip class="font-semibold truncate min-w-1/2" show-on-truncate-only>
                <template #title>{{ table.column.title }}</template>
                {{ table.column.title }}</NcTooltip
              >
              <div class="inline-flex items-center truncate gap-2">
                <div class="text-[0.65rem] flex-1 truncate text-gray-600 nc-relation-details">
                  <span class="uppercase">{{ table.col.type }}</span>
                  <span class="truncate">{{ table.title || table.table_name }}</span>
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

      <a-form-item class="flex w-1/2" :label="$t('labels.childField')" v-bind="validateInfos.fk_lookup_column_id">
        <a-select
          v-model:value="vModel.fk_lookup_column_id"
          name="fk_lookup_column_id"
          dropdown-class-name="nc-dropdown-relation-column !rounded-md"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="(column, index) of columns" :key="index" :value="column.id">
            <div class="flex gap-2 truncate items-center">
              <div class="inline-flex items-center flex-1 truncate font-semibold">
                <component :is="cellIcon(column)" :column-meta="column" />
                <div class="truncate flex-1">{{ column.title }}</div>
              </div>

              <component
                :is="iconMap.check"
                v-if="vModel.fk_lookup_column_id === column.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
    <div v-else>{{ $t('msg.linkColumnClearNotSupportedYet') }}</div>
  </div>
</template>

<style scoped>
:deep(.ant-select-selector .ant-select-selection-item .nc-relation-details) {
  @apply hidden;
}
</style>
