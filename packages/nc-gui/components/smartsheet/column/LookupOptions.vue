<script setup lang="ts">
import { onMounted } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, LookupType, TableType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const { setAdditionalValidations, validateInfos, onDataTypeChange, isEdit, disableSubmitBtn, updateFieldName } =
  useColumnCreateStoreOrThrow()

const baseStore = useBase()

const { tables } = storeToRefs(baseStore)

const { metas, getMeta } = useMetas()

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
      ...(tables.value.find((table) => table.id === (column.colOptions as LinkToAnotherRecordType).fk_related_model_id) ||
        metas.value[(column.colOptions as LinkToAnotherRecordType).fk_related_model_id!] ||
        {}),
    }))
    .filter((table) => (table.col as LinkToAnotherRecordType)?.fk_related_model_id === table.id && !table.mm)
  return _refTables as Required<TableType & { column: ColumnType; col: Required<LinkToAnotherRecordType> }>[]
})

const selectedTable = computed(() => {
  return refTables.value.find((t) => t.column.id === vModel.value.fk_relation_column_id)
})

// Todo: Add backend api level validation for unsupported fields
const unsupportedUITypes = [UITypes.Button, UITypes.Links]

const columns = computed<ColumnType[]>(() => {
  if (!selectedTable.value?.id) {
    return []
  }
  return metas.value[selectedTable.value.id]?.columns.filter(
    (c: ColumnType) =>
      vModel.value.fk_lookup_column_id === c.id ||
      (!isSystemColumn(c) && c.id !== vModel.value.id && !unsupportedUITypes.includes(c.uidt)),
  )
})

onMounted(() => {
  if (isEdit.value) {
    vModel.value.fk_lookup_column_id = vModel.value.colOptions?.fk_lookup_column_id
    vModel.value.fk_relation_column_id = vModel.value.colOptions?.fk_relation_column_id
  }
})

const getNextColumnId = () => {
  const usedLookupColumnIds = (meta.value?.columns || [])
    .filter((c) => c.uidt === UITypes.Lookup)
    .map((c) => (c.colOptions as LookupType)?.fk_lookup_column_id)

  return columns.value.find((c) => !usedLookupColumnIds.includes(c.id))?.id
}

const onRelationColChange = async () => {
  if (selectedTable.value) {
    await getMeta(selectedTable.value.id)
  }
  vModel.value.fk_lookup_column_id = getNextColumnId() || columns.value?.[0]?.id
  onDataTypeChange()
}

watchEffect(() => {
  if (!refTables.value.length) {
    disableSubmitBtn.value = true
  } else if (refTables.value.length && disableSubmitBtn.value) {
    disableSubmitBtn.value = false
  }
})

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })

watch(
  () => vModel.value.fk_relation_column_id,
  (newValue) => {
    if (!newValue) return

    const selectedTable = refTables.value.find((t) => t.col.fk_column_id === newValue)
    if (selectedTable) {
      vModel.value.lookupTableTitle = selectedTable?.title || selectedTable.table_name
    }
  },
)

watch(
  () => vModel.value.fk_lookup_column_id,
  (newValue) => {
    if (!newValue) return

    const selectedColumn = columns.value.find((c) => c.id === newValue)
    if (selectedColumn) {
      vModel.value.lookupColumnTitle = selectedColumn?.title || selectedColumn.column_name

      updateFieldName()
    }
  },
)
</script>

<template>
  <div v-if="refTables.length" class="w-full flex flex-row space-x-2">
    <a-form-item
      class="flex w-1/2 !max-w-[calc(50%_-_4px)]"
      :label="`${$t('general.link')} ${$t('objects.field')}`"
      v-bind="validateInfos.fk_relation_column_id"
    >
      <a-select
        v-model:value="vModel.fk_relation_column_id"
        placeholder="-select-"
        dropdown-class-name="!w-64 !rounded-md nc-dropdown-relation-table"
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
      :label="`${$t('datatype.Lookup')} ${$t('objects.field')}`"
      v-bind="vModel.fk_relation_column_id ? validateInfos.fk_lookup_column_id : undefined"
    >
      <a-select
        v-model:value="vModel.fk_lookup_column_id"
        name="fk_lookup_column_id"
        placeholder="-select-"
        :disabled="!vModel.fk_relation_column_id"
        show-search
        :filter-option="antSelectFilterOption"
        dropdown-class-name="nc-dropdown-relation-column !rounded-md"
        @change="onDataTypeChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-gray-700" />
        </template>
        <a-select-option v-for="column of columns" :key="column.title" :value="column.id">
          <div class="w-full flex gap-2 truncate items-center justify-between">
            <div class="inline-flex items-center gap-2 flex-1 truncate">
              <component :is="cellIcon(column)" :column-meta="column" class="!mx-0" />
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
  <div v-else>
    <a-alert type="warning" show-icon>
      <template #icon><GeneralIcon icon="alertTriangle" class="h-6 w-6" width="24" height="24" /></template>
      <template #message> Alert </template>
      <template #description>
        {{
          $t('msg.linkColumnClearNotSupportedYet', {
            type: 'Lookup',
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
