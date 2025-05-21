<script lang="ts" setup>
import { FormulaDataTypes, handleTZ } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useDetachedLongText } from '../smartsheet/grid/canvas/composables/useDetachedLongText'

provide(IsUnderFormulaInj, ref(true))

// todo: column type doesn't have required property `error` - throws in typecheck
const column = inject(ColumnInj) as Ref<ColumnType & { colOptions: { error: any } }>

const cellValue = inject(CellValueInj)

const { isPg } = useBase()

const { showNull } = useGlobal()

const result = computed(() =>
  isPg(column.value.source_id) ? renderValue(handleTZ(cellValue?.value)) : renderValue(cellValue?.value),
)

const urls = computed(() => replaceUrlsWithLink(result.value))
const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const isNumber = computed(() => (column.value.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC)

const { open: openDetachedLongText } = useDetachedLongText()

const isStringDataType = computed(() => {
  if (isUnderLookup.value) return false

  return (
    !(column.value.colOptions as any)?.parsed_tree?.dataType ||
    (column.value.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.STRING
  )
})

const openLongText = (event: MouseEvent) => {
  if (!isStringDataType.value) return

  const target = event.target as HTMLElement
  if (target.tagName === 'A') {
    event.stopPropagation()
    return
  }

  openDetachedLongText({
    column: column.value,
    vModel: result.value,
  })
}

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning({
    onEnter: (e) => {
      if (isStringDataType.value) {
        openLongText(e)
      }
    },
  })

const rowHeight = inject(RowHeightInj, ref(undefined))

const isGrid = inject(IsGridInj, ref(false))

const updatedColumn = computed(() => {
  if (column.value.meta?.display_type) {
    return {
      ...column.value,
      uidt: column.value.meta?.display_type,
      ...column.value.meta?.display_column_meta,
    }
  }
})

const renderAsCell = computed(() => {
  return !!column.value.meta?.display_type
})
</script>

<template>
  <LazySmartsheetFormulaWrapperCell v-if="renderAsCell" :column="updatedColumn" />
  <template v-else-if="showNull && (ncIsNull(cellValue) || ncIsUndefined(cellValue))">
    <div
      class="nc-cell w-full h-full relative nc-display-value-cell"
      :class="{ 'text-right': isNumber && isGrid && !isExpandedFormOpen }"
    >
      <LazyCellNull />
    </div>
  </template>
  <div v-else class="w-full" :class="{ 'text-right': isNumber && isGrid && !isExpandedFormOpen }">
    <a-tooltip v-if="column && column.colOptions && column.colOptions.error" placement="bottom" class="text-orange-700">
      <template #title>
        <span class="font-bold">{{ column.colOptions.error }}</span>
      </template>
      <span>ERR!</span>
    </a-tooltip>

    <div v-else class="nc-cell-field group py-1" @dblclick="activateShowEditNonEditableFieldWarning">
      <div
        v-if="urls"
        :style="{
          'display': '-webkit-box',
          'max-width': '100%',
          '-webkit-line-clamp': rowHeight || 1,
          '-webkit-box-orient': 'vertical',
          'overflow': 'hidden',
          'word-break': 'break-all',
        }"
        @click="openLongText"
        v-html="urls"
      />

      <LazyCellClampedText v-else :value="result" :lines="rowHeight" />

      <div v-if="!isUnderLookup && showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldEditWarning') }}
      </div>
      <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldDeleteWarning') }}
      </div>

      <NcTooltip
        v-if="isStringDataType"
        placement="bottom"
        class="nc-action-icon hidden group-hover:block absolute right-4 top-1"
      >
        <template #title>{{ isExpandedFormOpen ? $t('title.expand') : $t('tooltip.expandShiftSpace') }}</template>
        <NcButton
          type="secondary"
          size="xsmall"
          class="nc-textarea-expand !p-0 !w-5 !h-5 !min-w-[fit-content]"
          @click.stop="openLongText"
        >
          <component :is="iconMap.maximize" class="transform group-hover:(!text-grey-800) text-gray-700 w-3 h-3" />
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>
