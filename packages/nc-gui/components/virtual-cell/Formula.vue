<script lang="ts" setup>
import { FormulaDataTypes, UITypes, handleTZ } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'

provide(IsUnderFormulaInj, ref(true))

// todo: column type doesn't have required property `error` - throws in typecheck
const column = inject(ColumnInj) as Ref<ColumnType & { colOptions: { error: any } }>

const cellValue = inject(CellValueInj)

const { isPg } = useBase()

const result = computed(() =>
  isPg(column.value.source_id) ? renderValue(handleTZ(cellValue?.value)) : renderValue(cellValue?.value),
)

const urls = computed(() => replaceUrlsWithLink(result.value))
const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning()

const isNumber = computed(() => (column.value.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC)

const isStringDataType = computed(() => {
  if (isUnderLookup.value) return false

  return (
    !(column.value.colOptions as any)?.parsed_tree?.dataType ||
    (column.value.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.STRING
  )
})

const rowHeight = inject(RowHeightInj, ref(undefined))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const updatedColumn = computed(() => {
  if (column.value.meta?.display_type) {
    return {
      ...column.value,
      uidt: column.value.meta?.display_type,
      ...column.value.meta?.display_column_meta,
    }
  } else if (isStringDataType.value) {
    return {
      ...column.value,
      uidt: UITypes.LongText,
    }
  }
})
</script>

<template>
  <LazySmartsheetFormulaWrapperCell
    v-if="column.meta?.display_type || isStringDataType"
    v-model="cellValue"
    :column="updatedColumn"
  />

  <div v-else class="w-full" :class="{ 'text-right': isNumber && isGrid && !isExpandedFormOpen }">
    <a-tooltip v-if="column && column.colOptions && column.colOptions.error" placement="bottom" class="text-orange-700">
      <template #title>
        <span class="font-bold">{{ column.colOptions.error }}</span>
      </template>
      <span>ERR!</span>
    </a-tooltip>

    <div v-else class="nc-cell-field py-1" @dblclick="activateShowEditNonEditableFieldWarning">
      <div v-if="urls" v-html="urls" />

      <LazyCellClampedText v-else :value="result" :lines="rowHeight" />

      <div v-if="!isUnderLookup && showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldEditWarning') }}
      </div>
      <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldDeleteWarning') }}
      </div>
    </div>
  </div>
</template>
