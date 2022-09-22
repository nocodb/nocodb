<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import { MetaInj } from '#imports'

interface Props {
  value: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits(['update:value'])
const vModel = useVModel(props, 'value', emit)

const meta = $(inject(MetaInj, ref()))

const { setAdditionalValidations, validateInfos, onDataTypeChange } = useColumnCreateStoreOrThrow()

const { tables } = $(useProject())

const { metas } = $(useMetas())

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: 'Required' }],
  fk_lookup_column_id: [{ required: true, message: 'Required' }],
})

if (!vModel.value.fk_relation_column_id) vModel.value.fk_relation_column_id = null
if (!vModel.value.fk_lookup_column_id) vModel.value.fk_lookup_column_id = null

const relationNames = {
  mm: 'Many To Many',
  hm: 'Has Many',
  bt: 'Belongs To',
}

const refTables = $computed(() => {
  if (!tables || !tables.length) {
    return []
  }

  return meta?.columns
    ?.filter((c: any) => c.uidt === UITypes.LinkToAnotherRecord && !c.system)
    .map((c: ColumnType) => ({
      col: c.colOptions,
      column: c,
      ...tables.find((t) => t.id === (c.colOptions as LinkToAnotherRecordType).fk_related_model_id),
    }))
    .filter((table: any) => table.col.fk_related_model_id === table.id && !table.mm)
})

const columns = $computed(() => {
  const selectedTable = refTables?.find((t) => t.column.id === vModel.value.fk_relation_column_id)
  if (!selectedTable?.id) {
    return []
  }

  return metas[selectedTable.id].columns.filter((c: any) => !isSystemColumn(c))
})
</script>

<template>
  <div class="p-6 w-full flex flex-col border-2 mb-2 mt-4">
    <div class="w-full flex flex-row space-x-2">
      <a-form-item class="flex w-1/2 pb-2" :label="$t('labels.childTable')" v-bind="validateInfos.fk_relation_column_id">
        <a-select
          v-model:value="vModel.fk_relation_column_id"
          dropdown-class-name="!w-64 nc-dropdown-relation-table"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="(table, index) in refTables" :key="index" :value="table.col.fk_column_id">
            <div class="flex flex-row space-x-0.5 h-full pb-0.5 items-center justify-between">
              <div class="font-semibold text-xs">{{ table.column.title }}</div>
              <div class="text-[0.65rem] text-gray-600">
                {{ relationNames[table.col.type] }} {{ table.title || table.table_name }}
              </div>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item class="flex w-1/2" :label="$t('labels.childColumn')" v-bind="validateInfos.fk_lookup_column_id">
        <a-select
          v-model:value="vModel.fk_lookup_column_id"
          name="fk_lookup_column_id"
          dropdown-class-name="nc-dropdown-relation-column"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="(column, index) of columns" :key="index" :value="column.id">
            {{ column.title }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
  </div>
</template>

<style scoped></style>
