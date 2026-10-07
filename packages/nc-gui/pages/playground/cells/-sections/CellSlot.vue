<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { syncLinkedValues } from '../-helper/mock-api'
import type { Row } from '~/lib/types'

const props = defineProps<{
  column: ColumnType
  row: Row
  mode: 'idle' | 'edit' | 'expanded'
  readOnly?: boolean
}>()

// Picker editors start closed so a page load never opens an overlay.
const POPUP_ON_EDIT_UIDTS: string[] = [UITypes.Colour]

const row = toRef(props, 'row')

const isExpanded = computed(() => props.mode === 'expanded')

const isActive = computed(() => props.mode !== 'idle')

const isPopupEditor = POPUP_ON_EDIT_UIDTS.includes(props.column.uidt as string)

const editEnabled = ref(props.mode === 'edit' && !isPopupEditor)

const title = computed(() => props.column.title!)

provide(IsExpandedFormOpenInj, isExpanded)

provide(IsGridInj, ref(props.mode !== 'expanded'))

provide(IsFormInj, ref(false))

// a short row sizes QR / barcode / clamped text to one line, as in the grid
if (props.mode !== 'expanded') provide(RowHeightInj, ref(1 as const))

// the grid refetches the row after a link pick; read the mocked links back
const reloadRowHook = createEventHook()

reloadRowHook.on(() => syncLinkedValues(row.value.row))

provide(ReloadRowDataHookInj, reloadRowHook)

useProvideSmartsheetRowStore(row)
</script>

<template>
  <div v-if="mode === 'expanded'" class="nc-expanded-form-row w-full" :class="`nc-expand-col-${title}`">
    <div class="nc-expanded-cell w-full flex">
      <SmartsheetDivDataCell
        class="pg-expanded-cell flex-1 flex relative min-h-8 items-center bg-nc-bg-elevated px-1"
        :class="{ '!select-text nc-readonly-div-data-cell': readOnly }"
      >
        <SmartsheetVirtualCell
          v-if="isVirtualCol(column)"
          v-model="row.row[title]"
          :column="column"
          :row="row"
          :read-only="readOnly"
        />
        <!-- expanded form keeps every editor open, like ColumnList -->
        <SmartsheetCell v-else v-model="row.row[title]" :edit-enabled="true" :column="column" active :read-only="readOnly" />
      </SmartsheetDivDataCell>
    </div>
  </div>

  <!-- inactive: an active TableDataCell binds a window keydown listener every slot would react to -->
  <SmartsheetTableDataCell
    v-else
    :active="false"
    class="pg-grid-cell"
    :class="{ 'pg-grid-cell-edit': mode === 'edit' || editEnabled }"
    @dblclick="!readOnly && (editEnabled = true)"
  >
    <div class="w-full min-w-0">
      <SmartsheetVirtualCell
        v-if="isVirtualCol(column)"
        v-model="row.row[title]"
        :column="column"
        :row="row"
        :active="isActive"
        :read-only="readOnly"
      />
      <SmartsheetCell
        v-else
        v-model="row.row[title]"
        v-model:edit-enabled="editEnabled"
        :column="column"
        :active="isActive"
        :read-only="readOnly"
      />
    </div>
  </SmartsheetTableDataCell>
</template>

<style scoped lang="scss">
.pg-grid-cell {
  @apply relative w-full flex items-center min-h-8 px-3 bg-nc-bg-default text-small leading-[18px] overflow-hidden;
  border: 1px solid var(--nc-grid-line, var(--nc-border-gray-light));
}

.pg-grid-cell:not(.pg-grid-cell-edit) {
  @apply h-8;
}

/* an overlay like grid/Table.vue's td.active::after, so editor inputs can't paint over the ring */
.pg-grid-cell-edit::after {
  content: '';
  @apply absolute inset-0 z-3 pointer-events-none;
  border: 2px solid var(--nc-border-brand);
  border-radius: 2px;
}

/* copied from ColumnList.vue (scoped there) */
.pg-expanded-cell {
  @apply !rounded-lg;
  transition: all 0.3s;

  [theme='dark']
    &:not(.nc-readonly-div-data-cell):not(:has(.nc-virtual-cell-qrcode)):not(:has(.nc-virtual-cell-barcode)):not(
      :has(.nc-virtual-cell-button)
    ):not(:has(.nc-cell-attachment)) {
    background-color: var(--nc-bg-input);
    border-color: var(--nc-border-input);
  }

  &:not(:focus-within):hover:not(.nc-readonly-div-data-cell):not(:has(.nc-virtual-cell-button)) {
    box-shadow: 0px 0px 4px 0px rgba(var(--rgb-base), 0.12);
  }

  &:focus-within:not(.nc-readonly-div-data-cell) {
    @apply !shadow-selected !border-1 !border-nc-border-brand;
  }

  &.nc-readonly-div-data-cell {
    @apply !border-nc-border-gray-medium;

    :deep(.nc-cell),
    :deep(.nc-virtual-cell) {
      @apply text-nc-content-gray-muted;
    }
  }

  :deep(.nc-cell),
  :deep(.nc-virtual-cell) {
    @apply h-auto;
  }

  /* mirrors expanded-form/index.vue's global rule, which only loads with that lazy component */
  :deep(.nc-cell .nc-cell-field),
  :deep(.nc-cell .nc-cell-field-link),
  :deep(.nc-cell input),
  :deep(.nc-cell textarea),
  :deep(.nc-cell select),
  :deep(.nc-virtual-cell .nc-cell-field),
  :deep(.nc-virtual-cell input) {
    font-size: 13px !important;
  }

  :deep(.nc-cell .nc-cell-field),
  :deep(.nc-virtual-cell .nc-cell-field) {
    @apply px-2;
  }

  :deep(.nc-cell-field.nc-lookup-cell .nc-cell-field) {
    @apply px-0;
  }
}
</style>
