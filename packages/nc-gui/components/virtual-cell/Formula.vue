<script lang="ts" setup>
import { FormulaDataTypes, handleTZ } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'

// todo: column type doesn't have required property `error` - throws in typecheck
const column = inject(ColumnInj) as Ref<ColumnType & { colOptions: { error: any } }>

const isHovered = ref(false);

const cellValue = inject(CellValueInj)

const { isPg } = useBase()

const result = computed(() =>
  isPg(column.value.source_id) ? renderValue(handleTZ(cellValue?.value)) : renderValue(cellValue?.value),
)

const isVisible = ref(false)




////for closing the expanded model
const closeModel = () => {
  isVisible.value = false
}



const onExpand = () => {
  isVisible.value = true
}

const urls = computed(() => replaceUrlsWithLink(result.value))

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning()

const isNumber = computed(() => (column.value.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC)

const rowHeight = inject(RowHeightInj, ref(undefined))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))
</script>

<template>
  <LazySmartsheetFormulaWrapperCell
    v-if="column.meta?.display_type"
    v-model="cellValue"
    :column="{
      uidt: column.meta?.display_type,
      ...column.meta?.display_column_meta,
    }"
  />

  <div v-else class="w-full" :class="{ 'text-right': isNumber && isGrid && !isExpandedFormOpen }"
    @mouseover="isHovered = true" @mouseleave="isHovered = false">
    <a-tooltip v-if="column && column.colOptions && column.colOptions.error" placement="bottom" class="text-orange-700">
      <template #title>
        <span class="font-bold">{{ column.colOptions.error }}</span>
      </template>
      <span>ERR!</span>
    </a-tooltip>

    <div v-else class="nc-cell-field py-1" @dblclick="activateShowEditNonEditableFieldWarning">
      <div v-if="urls" v-html="urls" />

      <LazyCellClampedText v-else :value="result" :lines="rowHeight" />



      <NcTooltip v-if="!isVisible" placement="bottom"
        class="nc-action-icon !absolute  nc-text-area-expand-btn group-hover:block z-3" :class="{
  'hidden': !isHovered, 'block': isHovered, 
  'right-1': isExpandedFormOpen,
          'right-3': !isExpandedFormOpen,
          'top-0': isGrid && !isExpandedFormOpen&& !(!rowHeight || rowHeight === 1),
          'top-1': !(isGrid && !isExpandedFormOpen ),
        }" :style="isGrid && !isExpandedFormOpen && (!rowHeight || rowHeight === 1)
            ? { top: '50%', transform: 'translateY(-50%)' }
            : undefined
          ">
        <template #title>{{ $t('title.expand') }}</template>
        <NcButton type="secondary" size="xsmall" data-testid="attachment-cell-file-picker-button"
          class="!p-0 !w-5 !h-5 !min-w-[fit-content]" @click.stop="onExpand">
          <component :is="iconMap.expand" class="transform group-hover:(!text-grey-800) text-gray-700 text-xs" />
        </NcButton>
      </NcTooltip>
      <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldEditWarning') }}
      </div>
      <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldDeleteWarning') }}
      </div>
    </div>
    <SmartsheetDialogModelVirtualTextCellExpand v-on:close="closeModel" :model-value="cellValue"
      :is-visible="isVisible">
    </SmartsheetDialogModelVirtualTextCellExpand>
  </div>
  <!-- <LazyCellTextArea  v-model="vModel" :virtual="true" /> -->

</template>
<style lang="scss">
.cell:hover .nc-text-area-expand-btn,
.long-text-wrapper:hover .nc-text-area-expand-btn {
  @apply !block cursor-pointer;
}
</style>
