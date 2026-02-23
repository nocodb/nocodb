<script lang="ts" setup>
import { type ColumnType, ViewTypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { useDedupeOrThrow } from '../lib/useDedupe'

const { config, meta, onTableSelect, saveConfig, loadGroupSets, hasMergedAnyRecords } = useDedupeOrThrow()

const { loadTableMeta } = useTablesStore()

const isOpenColumnSelectDropdown = ref(false)

const filterColumn = (column: ColumnType) => {
  return !isSystemColumn(column) && !isVirtualCol(column) && !isAttachment(column)
}

const columnList = computedAsync(async () => {
  let fields: ColumnType[]

  if (config.value.selectedTableId) {
    const tableMeta = await loadTableMeta(config.value.selectedTableId)
    fields = tableMeta?.columns || []
  } else {
    fields = meta.value?.columns || []
  }

  fields = fields.filter(filterColumn)

  return fields.map((column) => ({
    label: column.title || column.column_name,
    value: column.id,
    ...column,
  }))
}, [])

const columnListMap = computed(() => {
  if (!columnList.value || columnList.value.length === 0) return new Map()
  return new Map(columnList.value.map((column) => [column.value, column]))
})

const selectedColumnLabel = computed(() => {
  const count = config.value.selectedFieldIds.length
  if (count === 0) return '-- Select field(s) --'
  if (count === 1) {
    const col = columnListMap.value.get(config.value.selectedFieldIds[0])
    return col?.label || '1 field selected'
  }
  return `${count} fields selected`
})

// Debounce group set loading to avoid redundant API calls when toggling multiple fields quickly
const debouncedLoadGroupSets = useDebounceFn(() => {
  loadGroupSets()
}, 500)

const onSelectField = (value: any) => {
  config.value.selectedFieldIds = value
  saveConfig()
  debouncedLoadGroupSets()
}

onMounted(() => {
  if (!config.value.selectedFieldIds.length && !hasMergedAnyRecords.value) return

  loadGroupSets(true)
})
</script>

<template>
  <div class="flex flex-col gap-3 py-4">
    <NcListTableSelector
      v-model:value="config.selectedTableId"
      force-layout="vertical"
      @update:value="(value) => onTableSelect(value as string)"
    />

    <NcListViewSelector
      v-model:value="config.selectedViewId"
      :table-id="config.selectedTableId"
      :disabled="!config.selectedTableId"
      force-layout="vertical"
      :filter-view="(view) => view.type !== ViewTypes.FORM"
      @update:value="saveConfig"
    />

    <a-form-item
      name="columnIds"
      class="!mb-0 nc-column-selector nc-force-layout-vertical"
      @click.stop
      @dblclick.stop
    >
      <template #label>
        <div>Field(s)</div>
      </template>
      <NcListDropdown
        v-model:is-open="isOpenColumnSelectDropdown"
        :disabled="!config.selectedTableId || !config.selectedViewId"
      >
        <div class="flex-1 flex group items-center gap-2 min-w-0">
          <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
            <span
              class="text-sm flex-1 truncate"
              :class="{
                'text-nc-content-gray-muted': !config.selectedFieldIds.length,
              }"
            >
              {{ selectedColumnLabel }}
            </span>

            <template #title>
              {{ selectedColumnLabel }}
            </template>
          </NcTooltip>

          <GeneralIcon
            v-if="config.selectedFieldIds.length"
            class="hidden text-nc-content-gray-muted transition group-hover:!block h-4 w-4 cursor-pointer"
            icon="ncXCircle"
            @click.stop="onSelectField([])"
          />

          <GeneralIcon
            icon="ncChevronDown"
            class="flex-none h-4 w-4 transition-transform opacity-70"
            :class="{ 'transform rotate-180': isOpenColumnSelectDropdown }"
          />
        </div>
        <template #overlay="{ onEsc }">
          <NcList
            v-model:open="isOpenColumnSelectDropdown"
            :value="config.selectedFieldIds"
            :list="columnList"
            variant="medium"
            :close-on-select="false"
            :is-multi-select="true"
            class="!w-auto"
            wrapper-class-name="!h-auto"
            @update:value="onSelectField"
            @escape="onEsc"
          >
            <template #listItemExtraLeft="{ option }">
              <div class="min-w-5 flex items-center justify-center">
                <SmartsheetHeaderIcon :column="option as ColumnType" color="text-nc-content-gray-muted" />
              </div>
            </template>
          </NcList>
        </template>
      </NcListDropdown>
    </a-form-item>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-form-item label) {
  @apply text-captionBold;
}

.nc-column-selector.ant-form-item {
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
}
</style>
