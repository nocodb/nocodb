<script setup lang="ts">
import { SyncType, UITypes } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

const { integrationConfigs, isLoadingSchema, loadDestinationSchema, syncConfigForm } = useSyncFormOrThrow()

const { t } = useI18n()

const mainIntegration = computed(() => integrationConfigs.value[0])

if (mainIntegration.value) {
  if (!mainIntegration.value.config) {
    mainIntegration.value.config = {}
  }
  if (!mainIntegration.value.config.custom_schema) {
    mainIntegration.value.config.custom_schema = {}
  }
}

const destinationSchema = computed<CustomSyncSchema>(() => mainIntegration.value?.config?.custom_schema || {})

const selectedTable = ref('')

const tableNames = computed(() => Object.keys(destinationSchema.value))

const abstractTypeToUITypes: Record<string, UITypes[]> = {
  string: [
    UITypes.SingleLineText,
    UITypes.LongText,
    UITypes.Email,
    UITypes.URL,
    UITypes.PhoneNumber,
    UITypes.SingleSelect,
    UITypes.MultiSelect,
  ],
  number: [UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Rating, UITypes.Duration, UITypes.Year],
  decimal: [UITypes.Decimal, UITypes.Number, UITypes.Currency, UITypes.Percent],
  boolean: [UITypes.Checkbox, UITypes.SingleLineText, UITypes.Number],
  date: [UITypes.Date, UITypes.DateTime],
  datetime: [UITypes.DateTime, UITypes.Date],
  time: [UITypes.Time, UITypes.SingleLineText],
  json: [UITypes.JSON, UITypes.LongText],
  jsonb: [UITypes.JSON, UITypes.LongText],
}

const fallbackUITypes = [UITypes.SingleLineText, UITypes.LongText]

const tableSelectedAll = computed(() => {
  const table = destinationSchema.value[selectedTable.value]
  return table?.columns?.every((column) => !column.exclude) ?? false
})

// Table columns for NcTable
const tableColumns = computed(() => [
  {
    name: t('labels.syncSchemaColInclude'),
    key: 'include',
    width: 80,
  },
  {
    name: t('labels.syncSchemaColName'),
    key: 'columnName',
    width: 200,
  },
  {
    name: t('labels.syncSchemaColOriginalType'),
    key: 'originalType',
    width: 150,
  },
  {
    name: t('labels.syncSchemaColTargetType'),
    key: 'targetType',
    width: 200,
  },
  {
    name: t('labels.syncSchemaColUniqueId'),
    key: 'uniqueId',
    width: 150,
  },
  {
    name: t('labels.syncSchemaColCreatedAt'),
    key: 'createdAt',
    width: 150,
  },
  {
    name: t('labels.syncSchemaColUpdatedAt'),
    key: 'updatedAt',
    width: 150,
  },
])

const tableData = computed(() => {
  const table = destinationSchema.value[selectedTable.value]
  if (!table?.columns) return []

  return table.columns.map((column, index) => ({
    ...column,
    _index: index,
  }))
})

// Helper functions
const isPrimaryKeyColumn = (columnTitle: string): boolean => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable?.systemFields?.primaryKey) return false
  return currentTable.systemFields.primaryKey.includes(columnTitle)
}

const countPrimaryKeys = (): number => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable?.systemFields?.primaryKey) return 0
  return currentTable.systemFields.primaryKey.length
}

// Resolve the compatible target types for a column. The abstract type is matched exactly —
// the previous substring match collapsed `datetime` into `date`, so timestamp columns could
// only be mapped to Date. When the abstract type is missing/unknown we derive the family from
// the already-detected `uidt`, and the detected `uidt` is always kept selectable so a column
// never silently degrades to SingleLineText.
const getAllowedUITypes = (column: { abstractType?: string | null; uidt?: string }) => {
  const abstractType = column.abstractType?.toLowerCase()
  // `uidt` comes from the stored schema as a plain string; it always holds a UIType value.
  const currentUidt = column.uidt as UITypes | undefined

  let allowed = abstractType ? abstractTypeToUITypes[abstractType] : undefined

  if (!allowed && currentUidt) {
    const uidt = currentUidt
    allowed = Object.values(abstractTypeToUITypes).find((types) => types.includes(uidt))
  }

  allowed = allowed ?? fallbackUITypes

  if (currentUidt && !allowed.includes(currentUidt)) {
    return [currentUidt, ...allowed]
  }

  return allowed
}

const getUITypeOptions = (column: { abstractType?: string | null; uidt?: string }) => {
  return getAllowedUITypes(column).map((type) => ({
    label: type,
    value: type,
  }))
}

const updateSchema = (newSchema: CustomSyncSchema) => {
  if (mainIntegration.value?.config) {
    mainIntegration.value.config.custom_schema = newSchema
  }
}

const toggleSelectAll = (checked: boolean) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (tableToUpdate?.columns) {
    tableToUpdate.columns.forEach((column) => {
      if (!isPrimaryKeyColumn(column.title)) {
        column.exclude = !checked
      }
    })
  }

  updateSchema(updatedSchema)
}

const updateColumn = (columnIndex: number, field: string, value: any) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable?.columns?.[columnIndex]) return

  const column = currentTable.columns[columnIndex]
  if (field === 'exclude' && value === true && isPrimaryKeyColumn(column.title)) {
    return
  }

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (tableToUpdate?.columns?.[columnIndex]) {
    ;(tableToUpdate.columns[columnIndex] as any)[field] = value
  }

  updateSchema(updatedSchema)
}

const togglePrimaryKey = (columnTitle: string, checked: boolean) => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  if (!checked && isPrimaryKeyColumn(columnTitle) && countPrimaryKeys() === 1) {
    return
  }

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (!tableToUpdate) return

  if (!tableToUpdate.systemFields) {
    tableToUpdate.systemFields = { primaryKey: [] }
  }

  if (checked) {
    if (!tableToUpdate.systemFields.primaryKey.includes(columnTitle)) {
      tableToUpdate.systemFields.primaryKey.push(columnTitle)

      const columnIndex = tableToUpdate.columns.findIndex((col) => col.title === columnTitle)
      if (columnIndex !== -1 && tableToUpdate.columns[columnIndex]) {
        tableToUpdate.columns[columnIndex].exclude = false
      }
    }
  } else {
    tableToUpdate.systemFields.primaryKey = tableToUpdate.systemFields.primaryKey.filter((key) => key !== columnTitle)
  }

  updateSchema(updatedSchema)
}

const toggleTimestampColumn = (columnTitle: string, type: 'createdAt' | 'updatedAt') => {
  const currentTable = destinationSchema.value[selectedTable.value]
  if (!currentTable) return

  const updatedSchema = { ...destinationSchema.value }
  const tableToUpdate = updatedSchema[selectedTable.value]

  if (!tableToUpdate) return

  if (!tableToUpdate.systemFields) {
    tableToUpdate.systemFields = { primaryKey: [] }
  }

  if (tableToUpdate.systemFields[type] === columnTitle) {
    tableToUpdate.systemFields[type] = undefined
  } else {
    tableToUpdate.systemFields[type] = columnTitle
  }

  updateSchema(updatedSchema)
}

const currentCreatedAtColumn = computed(() => {
  const currentTable = destinationSchema.value[selectedTable.value]
  return currentTable?.systemFields?.createdAt
})

const currentUpdatedAtColumn = computed(() => {
  const currentTable = destinationSchema.value[selectedTable.value]
  return currentTable?.systemFields?.updatedAt
})

const debouncedLoadDestinationSchema = useDebounceFn(loadDestinationSchema, 500)

// Keep the active tab valid: select the first table initially, and reset when the
// currently-selected table is no longer part of the schema.
watch(
  tableNames,
  (names) => {
    if (names.length === 0) {
      selectedTable.value = ''
    } else if (!selectedTable.value || !names.includes(selectedTable.value)) {
      selectedTable.value = names[0]
    }
  },
  { immediate: true },
)

// Re-derive the schema when the source table selection changes — the edit modal keeps this
// component mounted across tabs (`v-show`), so the schema computed on mount goes stale when
// tables are (de)selected in the Sources tab.
watch(
  () => mainIntegration.value?.config?.tables,
  () => {
    debouncedLoadDestinationSchema()
  },
  { deep: true },
)

onMounted(loadDestinationSchema)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <div class="text-bodyLgBold text-nc-content-gray mb-1">{{ $t('labels.syncSchemaMapTitle') }}</div>
      <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">{{ $t('labels.syncSchemaMapSubtitle') }}</div>
    </div>

    <div v-if="isLoadingSchema" class="flex items-center justify-center py-12">
      <GeneralLoader size="xlarge" />
    </div>

    <template v-else>
      <div v-if="tableNames.length > 0">
        <NcTabs v-model:active-key="selectedTable" class="nc-sync-schema-tabs">
          <a-tab-pane v-for="tableName in tableNames" :key="tableName" :tab="tableName" />
        </NcTabs>
      </div>

      <div v-if="selectedTable && destinationSchema[selectedTable]" class="flex flex-col gap-4">
        <NcAlert
          v-if="syncConfigForm.sync_type === SyncType.Incremental && !currentUpdatedAtColumn"
          type="warning"
          :message="$t('msg.warning.syncNoUpdatedAtColumn.title')"
          :description="$t('msg.warning.syncNoUpdatedAtColumn.description')"
          :show-icon="true"
        />

        <!-- Table Header with Select All -->
        <div class="flex items-center justify-between">
          <div class="text-bodyDefaultSmBold text-nc-content-gray">
            {{ $t('labels.syncSchemaTableLabel', { table: selectedTable }) }}
          </div>
          <NcCheckbox :checked="tableSelectedAll" @update:checked="toggleSelectAll">
            <span class="text-bodyDefaultSm text-nc-content-gray-subtle2">{{ $t('labels.syncSchemaSelectAllColumns') }}</span>
          </NcCheckbox>
        </div>

        <!-- Columns Table -->
        <NcTable :columns="tableColumns" :data="tableData" :bordered="false" :sticky-header="true" class="nc-sync-schema-table">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'include'">
              <div class="flex items-center justify-center">
                <NcCheckbox
                  :checked="!record.exclude || isPrimaryKeyColumn(record.title)"
                  :disabled="isPrimaryKeyColumn(record.title)"
                  @update:checked="(checked) => updateColumn(record._index, 'exclude', !checked)"
                />
              </div>
            </template>

            <template v-else-if="column.key === 'columnName'">
              <div class="text-bodyDefaultSm text-nc-content-gray font-medium">
                {{ record.title }}
              </div>
            </template>

            <template v-else-if="column.key === 'originalType'">
              <div class="text-bodyDefaultSm text-nc-content-gray-subtle2">
                {{ record.abstractType }}
              </div>
            </template>

            <template v-else-if="column.key === 'targetType'">
              <NcSelect :value="record.uidt" class="w-full" @change="(value) => updateColumn(record._index, 'uidt', value)">
                <a-select-option v-for="option in getUITypeOptions(record)" :key="option.value" :value="option.value">
                  <div class="flex items-center justify-between gap-2">
                    <NcTooltip class="truncate" show-on-truncate-only>
                      {{ option.label }}
                      <template #title>
                        {{ option.label }}
                      </template>
                    </NcTooltip>

                    <GeneralIcon
                      v-if="option.value === record.uidt"
                      id="nc-selected-item-icon"
                      class="flex-none text-nc-content-brand w-4 h-4"
                      icon="check"
                    />
                  </div>
                </a-select-option>
              </NcSelect>
            </template>

            <template v-else-if="column.key === 'uniqueId'">
              <div class="flex items-center justify-center">
                <NcCheckbox
                  :checked="isPrimaryKeyColumn(record.title)"
                  @update:checked="(checked) => togglePrimaryKey(record.title, checked)"
                />
              </div>
            </template>

            <template v-else-if="column.key === 'createdAt'">
              <div class="flex items-center justify-center">
                <NcButton
                  type="text"
                  size="xxsmall"
                  class="!w-5 !h-5 !p-0"
                  @click="toggleTimestampColumn(record.title, 'createdAt')"
                >
                  <div
                    class="w-4 h-4 rounded-full border-2 transition-all"
                    :class="
                      currentCreatedAtColumn === record.title
                        ? 'border-nc-border-brand bg-nc-bg-default relative'
                        : 'border-nc-border-gray-dark bg-nc-bg-default'
                    "
                  >
                    <div
                      v-if="currentCreatedAtColumn === record.title"
                      class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-nc-brand-500"
                    />
                  </div>
                </NcButton>
              </div>
            </template>

            <template v-else-if="column.key === 'updatedAt'">
              <div class="flex items-center justify-center">
                <NcButton
                  type="text"
                  size="xxsmall"
                  class="!w-5 !h-5 !p-0"
                  @click="toggleTimestampColumn(record.title, 'updatedAt')"
                >
                  <div
                    class="w-4 h-4 rounded-full border-2 transition-all"
                    :class="
                      currentUpdatedAtColumn === record.title
                        ? 'border-nc-border-brand bg-nc-bg-default relative'
                        : 'border-nc-border-gray-dark bg-nc-bg-default'
                    "
                  >
                    <div
                      v-if="currentUpdatedAtColumn === record.title"
                      class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-nc-brand-500"
                    />
                  </div>
                </NcButton>
              </div>
            </template>
          </template>
        </NcTable>
      </div>
      <NcEmptyPlaceholder
        v-else
        :title="$t('labels.syncSchemaNoTablesTitle')"
        :subtitle="$t('labels.syncSchemaNoTablesSubtitle')"
      >
        <template #icon>
          <GeneralIcon icon="ncZap" class="w-12 h-12 text-nc-content-gray-subtle2" />
        </template>
      </NcEmptyPlaceholder>
    </template>
  </div>
</template>

<style scoped lang="scss">
.nc-sync-schema-tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }
}

.nc-sync-schema-table {
  @apply h-140;
  :deep(.nc-table-header-cell) {
    @apply bg-nc-bg-gray-extralight text-bodyDefaultSmBold text-nc-content-gray;
  }

  :deep(.nc-table-cell) {
    @apply text-bodyDefaultSm;
  }
}
</style>
