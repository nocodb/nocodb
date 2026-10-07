<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { syncLinkedValues } from '../-helper/mock-api'
import type { Row } from '~/lib/types'

/** One cell rendered the way a given surface renders it; each slot owns a row store over the shared row. */
const props = defineProps<{
  column: ColumnType
  row: Row
  mode: 'idle' | 'edit' | 'expanded'
  readOnly?: boolean
}>()

// Editors that open a floating picker as soon as edit mode turns on; start them closed so a
// page load never opens an overlay. A click on the cell still opens it.
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

// grid/index.vue provides the view's row height; the short row sizes QR / barcode / clamped text to one line
if (props.mode !== 'expanded') provide(RowHeightInj, ref(1 as const))

// the grid refetches the row when a link picker asks; read the mocked links back instead
const reloadRowHook = createEventHook()

reloadRowHook.on(() => syncLinkedValues(row.value.row))

provide(ReloadRowDataHookInj, reloadRowHook)

useProvideSmartsheetRowStore(row)
</script>

<template>
  <!-- expanded form: ColumnList's row wrappers (global cell styles key off them) and SmartsheetDivDataCell -->
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
        <!-- one-way like ColumnList: the expanded form keeps every editor open -->
        <SmartsheetCell v-else v-model="row.row[title]" :edit-enabled="true" :column="column" active :read-only="readOnly" />
      </SmartsheetDivDataCell>
    </div>
  </div>

  <!-- grid: a flat 32px cell between grid lines; the active/edit cell gets the 2px brand ring.
       TableDataCell stays inactive: an active one binds a window keydown listener, and every edit slot would react to each key. -->
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

/* ColumnList.vue (scoped there) — the expanded-form field look */
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

  /* expanded-form/index.vue's global `.nc-drawer-expanded-form .nc-data-cell …` rule, which only
     loads with that (lazy) component */
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
