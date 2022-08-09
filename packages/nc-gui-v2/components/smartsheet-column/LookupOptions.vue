<script setup lang="ts">
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import { useColumnCreateStoreOrThrow } from '#imports'
import { MetaInj } from '~/context'

const { formState, validateInfos, onDataTypeChange, setAdditionalValidations } = $(useColumnCreateStoreOrThrow())
const { tables } = $(useProject())
const meta = $(inject(MetaInj))
const { metas } = $(useMetas())

setAdditionalValidations({
  fk_relation_column_id: [{ required: true, message: 'Required' }],
  fk_lookup_column_id: [{ required: true, message: 'Required' }],
})

if (!formState.fk_relation_column_id) formState.fk_relation_column_id = null
if (!formState.fk_lookup_column_id) formState.fk_lookup_column_id = null

const relationNames = {
  mm: 'Many To Many',
  hm: 'Has Many',
  bt: 'Belongs To',
}

const refTables = $computed(() => {
  if (!tables || !tables.length) {
    return []
  }

  return meta.columns
    .filter((c) => c.uidt === UITypes.LinkToAnotherRecord && !c.system)
    .map((c) => ({
      col: c.colOptions,
      column: c,
      ...tables.find((t) => t.id === c.colOptions.fk_related_model_id),
    }))
    .filter((table) => table.col.fk_related_model_id === table.id && !table.mm)
})

const columns = $computed(() => {
  const selectedTable = refTables.find((t) => t.column.id === formState.fk_relation_column_id)
  if (!selectedTable?.id) {
    return []
  }

  return metas[selectedTable.id].columns.filter((c) => !isSystemColumn(c))
})
</script>

<template>
  <div class="p-4 w-full flex flex-col border-2 mb-2 mt-4">
    <div class="w-full flex flex-row space-x-2">
      <a-form-item class="flex w-1/2 pb-2" :label="$t('labels.childTable')" v-bind="validateInfos.fk_relation_column_id">
        <a-select
          v-model:value="formState.fk_relation_column_id"
          size="small"
          dropdown-class-name="!w-64"
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
          v-model:value="formState.fk_lookup_column_id"
          name="fk_lookup_column_id"
          size="small"
          @change="onDataTypeChange"
        >
          <a-select-option v-for="(column, index) in columns" :key="index" :value="column.id">
            {{ column.title }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
  </div>
</template>

<style scoped></style>
