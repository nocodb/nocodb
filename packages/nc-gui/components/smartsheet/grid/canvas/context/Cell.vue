<script setup lang="ts">
import { type TableType, type ViewType, isAIPromptCol, isLinksOrLTAR } from 'nocodb-sdk'
import type { CellRange } from '../../../../../composables/useMultiSelect/cellRange'
import type { ActionManager } from '../loaders/ActionManager'
const props = defineProps<{
  selectedAllRecords: boolean
  contextMenuTarget: { row: number; col: number; path: Array<number> | null } | null
  selection: CellRange
  columns: CanvasGridColumn[]
  activeCell: {
    row?: number
    column?: number
    path?: Array<number>
  }
  isGroupBy: boolean
  isPrimaryKeyAvailable?: boolean
  isSelectionReadOnly: boolean
  isSelectionOnlyAI: {
    enabled: boolean
    disabled: boolean
  }
  isSelectionOnlyScript: {
    enabled: boolean
    disabled: boolean
  }
  actionManager: ActionManager
  isInsertBelowDisabled: boolean
  isOrderColumnExists: boolean
  deleteRow?: (rowIndex: number, undo?: boolean, path?: Array<number>) => Promise<void>
  deleteRangeOfRows: (cellRange: CellRange, path?: Array<number>) => Promise<void>
  deleteSelectedRows: (path?: Array<number>) => Promise<void>
  bulkDeleteAll: (path?: Array<number>) => Promise<void>
  callAddNewRow: (context: { row: number; col: number; path: Array<number> }, direction: 'above' | 'below') => void
  copyValue: (target: Cell, path?: Array<number>) => void
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  expandForm: (row: Row, state?: Record<string, any>, fromToolbar?: boolean, path?: Array<number>) => void
  clearCell: (ctx: { row: number; col: number; path: Array<number> } | null, skipUpdate?: boolean) => Promise<void>
  clearSelectedRangeOfCells: (path?: Array<number>) => Promise<void>
  getRows: (start: number, end: number, path?: Array<number>) => Promise<Row[]>
  getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
}>()

// Emits
const emits = defineEmits(['bulkUpdateDlg', 'update:selectedAllRecords'])

const {
  bulkDeleteAll,
  deleteRow,
  deleteSelectedRows,
  deleteRangeOfRows,
  expandForm,
  clearCell,
  clearSelectedRangeOfCells,
  getRows,
  getDataCache,
} = props

const contextMenuTarget = useVModel(props, 'contextMenuTarget', emits)
const vSelectedAllRecords = useVModel(props, 'selectedAllRecords', emits)

// To Refs
const isGroupBy = toRef(props, 'isGroupBy')
const selection = toRef(props, 'selection')
const actionManager = toRef(props, 'actionManager')
const columns = toRef(props, 'columns')
const isSelectionOnlyAI = toRef(props, 'isSelectionOnlyAI')
const isSelectionOnlyScript = toRef(props, 'isSelectionOnlyScript')
const activeCell = toRef(props, 'activeCell')
const isOrderColumnExists = toRef(props, 'isOrderColumnExists')

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

// Refs
const isDeleteAllRecordsModalOpen = ref(false)

// Composables
const { isDataReadOnly, isUIAllowed } = useRoles()
const { aiIntegrations } = useNocoAi()
const { isMobileMode } = useGlobal()
const { paste } = usePaste()
const { meta } = useSmartsheetStoreOrThrow()

// Computed States
const hasEditPermission = computed(() => isUIAllowed('dataEdit'))

const contextMenuRow = computed(() => (contextMenuTarget.value?.row !== -1 ? contextMenuTarget.value?.row : null))
const contextMenuCol = computed(() => (contextMenuTarget.value?.col !== -1 ? contextMenuTarget.value?.col : null))
const contextMenuPath = computed(() => {
  return isGroupBy.value
    ? contextMenuTarget.value?.path?.length
      ? contextMenuTarget.value?.path
      : null
    : contextMenuTarget.value?.path
})

const selectedRows = computed(() => {
  if (!contextMenuPath.value) return []
  const dataCache = getDataCache(contextMenuPath.value)
  return dataCache.selectedRows.value
})

const disablePasteCell = computed(() => {
  return (
    props.isSelectionReadOnly &&
    (!selection.value.isSingleCell() ||
      !contextMenuCol.value ||
      !contextMenuPath.value ||
      (!isMm(columns.value[contextMenuCol.value]?.columnObj) && !isBt(columns.value[contextMenuCol.value]?.columnObj)))
  )
})

const disableClearCell = computed(() => {
  return (
    props.isSelectionReadOnly &&
    (!selection.value.isSingleCell() ||
      !contextMenuPath.value ||
      !contextMenuCol.value ||
      !isLinksOrLTAR(columns.value[contextMenuCol.value]?.columnObj))
  )
})

async function deleteAllRecords() {
  isDeleteAllRecordsModalOpen.value = true

  const { totalRows } = getDataCache([])

  const { close } = useDialog(resolveComponent('DlgRecordDeleteAll'), {
    'modelValue': isDeleteAllRecordsModalOpen,
    'rows': totalRows.value,
    'onUpdate:modelValue': closeDlg,
    'onDeleteAll': async () => {
      await bulkDeleteAll?.([])
      closeDlg()
      vSelectedAllRecords.value = false
    },
  })

  function closeDlg() {
    isDeleteAllRecordsModalOpen.value = false
    close(200)
  }

  await until(isDeleteAllRecordsModalOpen).toBe(false)
}

const confirmDeleteRow = (row: number, path: Array<number>) => {
  try {
    deleteRow?.(row, false, path)

    if (selection.value.isRowInRange(row)) {
      selection.value.clear()
    }

    // If the active cell is in the row, clear the active cell
    if (activeCell.value && activeCell.value.row === row) {
      activeCell.value.row = -1
      activeCell.value.column = -1
    }
  } catch (e: any) {
    message.error(e.message)
  }
}

const deleteSelectedRangeOfRows = (path: Array<number>) => {
  deleteRangeOfRows?.(selection.value, path).then(() => {
    selection.value.clear()
    activeCell.value.row = -1
    activeCell.value.column = -1
    activeCell.value.path = path
  })
}

const commentRow = (rowId: number, path: Array<number>) => {
  try {
    // set the expanded form comment mode
    isExpandedFormCommentMode.value = true

    const dataCache = getDataCache(path)

    const row = dataCache.cachedRows.value.get(rowId)
    if (!row) return
    expandForm(row, {}, false, path)

    activeCell.value.row = -1
    activeCell.value.column = -1
    activeCell.value.path = path
    selection.value.clear()
  } catch (e: any) {
    message.error(e.message)
  }
}

const generateAIBulk = async (path: Array<number>) => {
  if (!isSelectionOnlyAI.value.enabled) return
  const column = columns.value[selection.value.start.col]

  const field = column?.columnObj

  if (!field || !field.id) return

  const rows = await getRows(selection.value.start.row, selection.value.end.row + 1, path)

  if (!rows || rows.length === 0) return

  const pks = rows
    .map((row) => ({
      pk: extractPkFromRow(row.row, meta.value?.columns),
      row,
    }))
    .filter((row) => row.pk !== null)

  await actionManager.value.executeButtonAction(
    pks.map((r) => r.pk),
    column,
    {
      row: pks.map((r) => r.row),
      isAiPromptCol: isAIPromptCol(column?.columnObj),
      path: contextMenuPath.value,
    },
  )
}
</script>

<template>
  <NcMenu class="!rounded !py-0" variant="small">
    <template v-if="!vSelectedAllRecords">
      <NcMenuItem
        v-if="isEeUI && contextMenuCol == null && contextMenuPath !== null && !isDataReadOnly && selectedRows.length"
        key="update-selected-rows"
        @click="emits('bulkUpdateDlg', contextMenuPath)"
      >
        <div v-e="['a:row:update-bulk']" class="flex gap-2 items-center">
          <GeneralIcon icon="ncEdit" />
          {{ $t('title.updateSelectedRows') }}
        </div>
      </NcMenuItem>

      <NcMenuItem
        v-if="contextMenuCol == null && !isDataReadOnly && contextMenuPath !== null && selectedRows.length"
        key="selete-selected-rows"
        class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
        data-testid="nc-delete-row"
        @click="deleteSelectedRows(contextMenuPath)"
      >
        <div v-if="selectedRows.length === 1" v-e="['a:row:delete']" class="flex gap-2 items-center">
          <GeneralIcon icon="delete" />
          {{ $t('activity.deleteSelectedRow') }}
        </div>
        <div v-else v-e="['a:row:delete-bulk']" class="flex gap-2 items-center">
          <GeneralIcon icon="delete" />
          {{ $t('activity.deleteSelectedRow') }}
        </div>
      </NcMenuItem>
    </template>
    <NcMenuItem
      v-if="vSelectedAllRecords && !isGroupBy"
      key="delete-all-rows"
      class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
      data-testid="nc-delete-all-row"
      @click="deleteAllRecords(contextMenuPath)"
    >
      <div v-e="['a:row:delete-all']" class="flex gap-2 items-center">
        <GeneralIcon icon="delete" />
        {{ $t('activity.deleteAllRecords') }}
      </div>
    </NcMenuItem>
    <template
      v-if="isOrderColumnExists && hasEditPermission && !isDataReadOnly && isPrimaryKeyAvailable && selection.isSingleCell()"
    >
      <NcMenuItem
        v-if="contextMenuCol !== null && contextMenuRow !== null && contextMenuPath !== null"
        key="insert-above"
        class="nc-base-menu-item"
        data-testid="context-menu-item-add-above"
        @click="callAddNewRow(contextMenuTarget, 'above')"
      >
        <div v-e="['a:row:insert:above']" class="flex gap-2 items-center">
          <GeneralIcon icon="ncChevronUp" />
          {{ $t('general.insertAbove') }}
        </div>
      </NcMenuItem>

      <NcMenuItem
        v-if="contextMenuCol !== null && contextMenuPath !== null && contextMenuRow !== null && !isInsertBelowDisabled"
        key="insert-below"
        class="nc-base-menu-item"
        data-testid="context-menu-item-add-below"
        @click="callAddNewRow(contextMenuTarget, 'below')"
      >
        <div v-e="['a:row:insert:below']" class="flex gap-2 items-center">
          <GeneralIcon icon="ncChevronDown" />
          {{ $t('general.insertBelow') }}
        </div>
      </NcMenuItem>
      <NcDivider v-if="contextMenuCol !== null && contextMenuRow !== null" />
    </template>

    <NcTooltip
      v-if="
        contextMenuCol !== null &&
        contextMenuPath !== null &&
        contextMenuRow !== null &&
        hasEditPermission &&
        !isDataReadOnly &&
        isSelectionOnlyAI.enabled
      "
      :disabled="!isSelectionOnlyAI.disabled"
    >
      <template #title>
        {{ aiIntegrations.length ? $t('tooltip.aiIntegrationReConfigure') : $t('tooltip.aiIntegrationAddAndReConfigure') }}
      </template>
      <NcMenuItem
        key="generate-ai"
        class="nc-base-menu-item"
        data-testid="context-menu-item-bulk"
        :disabled="isSelectionOnlyAI.disabled"
        @click="generateAIBulk(contextMenuPath)"
      >
        <div class="flex gap-2 items-center">
          <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
          <!-- Generate All -->
          Generate {{ selection.isSingleCell() ? 'Cell' : 'All' }}
        </div>
      </NcMenuItem>
    </NcTooltip>

    <NcMenuItem
      v-if="isSelectionOnlyScript.enabled"
      key="execute-script"
      class="nc-base-menu-item"
      data-testid="context-menu-item-bulk-script"
      :disabled="isSelectionOnlyScript.disabled"
    >
      <div class="flex gap-2 items-center">
        <GeneralIcon icon="ncScript" class="h-4 w-4" />
        <!-- Generate All -->
        Execute {{ selection.isSingleCell() ? 'Cell' : 'All' }}
      </div>
    </NcMenuItem>

    <NcMenuItem
      v-if="contextMenuCol !== null && contextMenuRow !== null && contextMenuPath !== null"
      key="cell-copy"
      class="nc-base-menu-item"
      data-testid="context-menu-item-copy"
      @click="copyValue(contextMenuTarget, contextMenuPath)"
    >
      <div v-e="['a:row:copy']" class="flex gap-2 items-center">
        <GeneralIcon icon="copy" />
        <!-- Copy -->
        {{ $t('general.copy') }} {{ $t('objects.cell').toLowerCase() }}
      </div>
    </NcMenuItem>

    <NcMenuItem
      v-if="contextMenuCol !== null && contextMenuPath && contextMenuRow !== null && hasEditPermission && !isDataReadOnly"
      key="cell-paste"
      class="nc-base-menu-item"
      data-testid="context-menu-item-paste"
      :disabled="disablePasteCell"
      @click="paste"
    >
      <div v-e="['a:row:paste']" class="flex gap-2 items-center">
        <GeneralIcon icon="paste" />
        <!-- Paste -->
        {{ $t('general.paste') }} {{ $t('objects.cell').toLowerCase() }}
      </div>
    </NcMenuItem>

    <NcMenuItem
      v-if="
        (contextMenuCol != null && contextMenuRow !== null && contextMenuPath !== null) &&
        hasEditPermission &&
        selection.isSingleCell() &&
        (isLinksOrLTAR(columns[contextMenuCol]?.columnObj!) || !columns[contextMenuCol]!.virtual) &&
        !isDataReadOnly
      "
      key="cell-clear"
      class="nc-base-menu-item"
      :disabled="disableClearCell"
      data-testid="context-menu-item-clear"
      @click="clearCell(contextMenuTarget)"
    >
      <div v-e="['a:row:clear']" class="flex gap-2 items-center">
        <GeneralIcon icon="close" />
        {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
      </div>
    </NcMenuItem>
    <NcMenuItem
      v-else-if="
        contextMenuCol !== null && contextMenuPath !== null && contextMenuRow !== null && hasEditPermission && !isDataReadOnly
      "
      key="cells-clear"
      class="nc-base-menu-item"
      :disabled="isSelectionReadOnly"
      data-testid="context-menu-item-clear"
      @click="clearSelectedRangeOfCells(contextMenuPath)"
    >
      <div v-e="['a:row:clear-range']" class="flex gap-2 items-center">
        <GeneralIcon icon="closeBox" class="text-gray-500" />
        {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
      </div>
    </NcMenuItem>

    <template
      v-if="
        contextMenuPath !== null &&
        contextMenuCol !== null &&
        contextMenuRow != null &&
        selection.isSingleCell() &&
        isUIAllowed('commentEdit') &&
        !isMobileMode
      "
    >
      <NcDivider />
      <NcMenuItem key="add-comment" class="nc-base-menu-item" @click="commentRow(contextMenuRow, contextMenuPath)">
        <div v-e="['a:row:comment']" class="flex gap-2 items-center">
          <MdiMessageOutline class="h-4 w-4" />
          {{ $t('general.add') }} {{ $t('general.comment').toLowerCase() }}
        </div>
      </NcMenuItem>
    </template>

    <template v-if="hasEditPermission && !isDataReadOnly">
      <NcDivider v-if="!(!contextMenuCol !== null && (selectedRows.length || vSelectedAllRecords))" />
      <NcMenuItem
        v-if="
          contextMenuPath !== null &&
          contextMenuCol !== null &&
          contextMenuRow != null &&
          (selection.isSingleCell() || selection.isSingleRow())
        "
        key="delete-row"
        class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
        @click="confirmDeleteRow(contextMenuRow, contextMenuPath)"
      >
        <div v-e="['a:row:delete']" class="flex gap-2 items-center">
          <GeneralIcon icon="delete" />
          <!-- Delete Row -->
          {{ $t('activity.deleteRow') }}
        </div>
      </NcMenuItem>
      <NcMenuItem
        v-else-if="contextMenuCol !== null && contextMenuRow !== null && contextMenuPath"
        key="delete-selected-row"
        class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
        @click="deleteSelectedRangeOfRows(contextMenuPath)"
      >
        <div v-e="['a:row:delete']" class="flex gap-2 items-center">
          <GeneralIcon icon="delete" class="text-gray-500 text-red-600" />
          <!-- Delete Rows -->
          {{ $t('activity.deleteRows') }}
        </div>
      </NcMenuItem>
    </template>
  </NcMenu>
</template>
