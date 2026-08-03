<script setup lang="ts">
import { PermissionEntity, PermissionKey, type TableType, type ViewType, isAIPromptCol, isLinksOrLTAR } from 'nocodb-sdk'
import type { CellRange } from '../../../../../composables/useMultiSelect/cellRange'
import type { ActionManager } from '../loaders/ActionManager'
const props = defineProps<{
  selectedAllRecords: boolean
  selectedAllRecordsSkipPks: Record<string, string>
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
  deleteRow?: (rowIndex: number, path?: Array<number>) => Promise<void>
  deleteRangeOfRows: (cellRange: CellRange, path?: Array<number>) => Promise<void>
  deleteSelectedRows: (path?: Array<number>) => Promise<void>
  bulkDeleteAll: (path?: Array<number>) => Promise<void>
  callAddNewRow: (context: { row: number; col: number; path: Array<number> }, direction: 'above' | 'below') => void
  duplicateRow: (context: { row: number; col: number; path: Array<number> }) => void
  copyValue: (target: Cell, path?: Array<number>) => void
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
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
const emits = defineEmits(['bulkUpdateDlg', 'update:selectedAllRecords', 'update:selectedAllRecordsSkipPks', 'sendRecord'])

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
const vSelectedAllRecordsSkipPks = useVModel(props, 'selectedAllRecordsSkipPks', emits)
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
const { isAiRecordContextEnabled, setAiRecordContext } = useAiRecordContext()
const { appInfo, isMobileMode } = useGlobal()
const { paste } = usePaste()
const { meta } = useSmartsheetStoreOrThrow()

const { copy } = useCopy()

const { t } = useI18n()
const metaInj = inject(MetaInj, ref())
const isPublic = inject(IsPublicInj, ref(false))

const isReadonly = inject(ReadonlyInj, ref(false))

// Interface pages flag row add/delete separately from cell editing.
const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

// Whether the interface viz opens records — gates the context-menu Expand item.
const interfaceClickIntoDetails = inject(InterfaceClickIntoDetailsInj, ref(true))

// Computed States
// Cell-level ops (paste / clear / AI) — interfaces gate these via edit_inline (ReadonlyInj).
const hasEditPermission = computed(() => isUIAllowed('dataEdit') && !isReadonly.value)

// Row-level ops (insert / duplicate / delete) — interfaces gate these via
// add_delete_inline ONLY; the two flags are orthogonal.
const canAddDeleteRows = computed(
  () => isUIAllowed('dataEdit') && (!interfacePageDataApi || interfacePageDataApi.canAddDeleteInline.value),
)
const isSyncedTable = computed(() => metaInj?.value?.synced || false)

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

const contextMenuRowId = computed(() => {
  if (contextMenuRow.value === null || !contextMenuPath.value) return null
  const dataCache = getDataCache(contextMenuPath.value)
  const row = dataCache.cachedRows.value.get(contextMenuRow.value)
  if (!row) return null
  return extractPkFromRow(row.row, meta.value?.columns)
})

const disablePasteCell = computed(() => {
  return (
    props.isSelectionReadOnly &&
    (!selection.value.isSingleCell() ||
      !contextMenuCol.value ||
      !contextMenuPath.value ||
      !columns.value[contextMenuCol.value]?.columnObj ||
      (!isMm(columns.value[contextMenuCol.value]?.columnObj) && !isBt(columns.value[contextMenuCol.value]?.columnObj)))
  )
})

const disableClearCell = computed(() => {
  return (
    props.isSelectionReadOnly &&
    (!selection.value.isSingleCell() ||
      !contextMenuPath.value ||
      !contextMenuCol.value ||
      !columns.value[contextMenuCol.value]?.columnObj ||
      !isLinksOrLTAR(columns.value[contextMenuCol.value]?.columnObj))
  )
})

async function deleteAllRecords() {
  isDeleteAllRecordsModalOpen.value = true

  const { totalRows } = getDataCache([])

  const allSelectedRecordCount = totalRows.value - Object.keys(vSelectedAllRecordsSkipPks.value).length

  const { close } = useDialog(resolveComponent('DlgRecordDeleteAll'), {
    'modelValue': isDeleteAllRecordsModalOpen,
    'rows': allSelectedRecordCount,
    'isSelectedAll': totalRows.value === allSelectedRecordCount,
    'onUpdate:modelValue': closeDlg,
    'onDeleteAll': async () => {
      await bulkDeleteAll?.([])
      closeDlg()
      vSelectedAllRecordsSkipPks.value = {}
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
    deleteRow?.(row, path)

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

/** Interface: expand the right-clicked record through the standard expand flow. */
function interfaceExpandRecord() {
  if (contextMenuRow.value === null || !contextMenuPath.value) return

  const dataCache = getDataCache(contextMenuPath.value)
  const row = dataCache.cachedRows.value.get(contextMenuRow.value)
  if (!row) return

  expandForm(row, {}, false, contextMenuPath.value)
}

/** Interface: deep link to this record — the current page URL with its rowId. */
async function interfaceCopyRecordUrl() {
  if (!contextMenuRowId.value) return

  const [origin, hash = ''] = window.location.href.split('#')
  const [hashPath, hashQuery = ''] = hash.split('?')
  const params = new URLSearchParams(hashQuery)
  params.set('rowId', contextMenuRowId.value)

  await copy(`${origin}#${hashPath}?${params.toString()}`)
  message.toast(t('msg.info.copiedToClipboard'))
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

// EE-only: put the right-clicked record into the AI chat context (mirrors the
// Alt+A keyboard handler). No-op in CE — `setAiRecordContext` is gated there.
function askAiAboutRecord() {
  if (contextMenuRow.value === null || !contextMenuPath.value || !meta.value?.id) return

  const row = getDataCache(contextMenuPath.value).cachedRows.value.get(contextMenuRow.value)
  const cols = meta.value?.columns ?? []
  if (!row) return

  const recordId = extractPkFromRow(row.row, cols)
  if (!recordId) return

  const pvCol = cols.find((c) => c.pv)
  const title = pvCol ? row.row[pvCol.title] : ''

  setAiRecordContext({
    tableId: meta.value.id,
    recordId: String(recordId),
    title: title != null ? String(title) : '',
  })
}

const execBulkAction = async (path: Array<number>) => {
  const column = columns.value[selection.value.start.col]

  const field = column?.columnObj

  if (!field || !field.id) return

  const rows = await getRows(selection.value.start.row, selection.value.end.row, path)

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
  <NcMenu
    :class="interfacePageDataApi ? '!rounded-lg nc-interface-record-context-menu' : '!rounded !py-0'"
    :variant="interfacePageDataApi ? 'medium' : 'small'"
  >
    <!-- Interface pages: record actions only — cell/schema/bulk ops are
         data-app vocabulary and stay out of interfaces. Duplicate/delete ride
         the add_delete_inline opt-in (canAddDeleteRows), like the "+" affordances. -->
    <template v-if="interfacePageDataApi">
      <!-- Multi-record selection: single-record actions would ambiguously
           target the right-clicked row — offer only the bulk delete. -->
      <!-- Select-ALL-records delete needs a where-scoped server op the interface
           doesn't have yet — only checkbox selections get the bulk action. -->
      <template v-if="selectedRows.length > 1 && !vSelectedAllRecords && canAddDeleteRows && !isDataReadOnly && !isSyncedTable">
        <NcMenuItem
          key="interface-delete-selected-records"
          class="nc-base-menu-item"
          danger
          data-testid="context-menu-item-interface-delete-selected"
          @click="deleteSelectedRows(contextMenuPath ?? undefined)"
        >
          <div v-e="['c:interface:grid:record:delete-selected']" class="text-bodyDefaultSm flex gap-2 items-center">
            <GeneralIcon icon="delete" />
            {{ $t('activity.deleteSelectedRow') }}
          </div>
        </NcMenuItem>
      </template>
      <template v-else>
        <template
          v-if="
            canAddDeleteRows &&
            !isDataReadOnly &&
            !isSyncedTable &&
            isOrderColumnExists &&
            isPrimaryKeyAvailable &&
            contextMenuRow !== null &&
            contextMenuPath !== null
          "
        >
          <NcMenuItem
            key="interface-insert-above"
            class="nc-base-menu-item"
            data-testid="context-menu-item-interface-add-above"
            @click="callAddNewRow(contextMenuTarget, 'above')"
          >
            <div v-e="['c:interface:grid:record:insert-above']" class="text-bodyDefaultSm flex gap-2 items-center">
              <GeneralIcon icon="ncChevronUp" />
              {{ $t('general.insertAbove') }}
            </div>
          </NcMenuItem>
          <NcMenuItem
            v-if="!isInsertBelowDisabled"
            key="interface-insert-below"
            class="nc-base-menu-item"
            data-testid="context-menu-item-interface-add-below"
            @click="callAddNewRow(contextMenuTarget, 'below')"
          >
            <div v-e="['c:interface:grid:record:insert-below']" class="text-bodyDefaultSm flex gap-2 items-center">
              <GeneralIcon icon="ncChevronDown" />
              {{ $t('general.insertBelow') }}
            </div>
          </NcMenuItem>
        </template>
        <NcMenuItem
          v-if="canAddDeleteRows && !isDataReadOnly && !isSyncedTable && contextMenuRow !== null && contextMenuPath !== null"
          key="interface-duplicate-record"
          class="nc-base-menu-item"
          data-testid="context-menu-item-interface-duplicate"
          @click="duplicateRow(contextMenuTarget)"
        >
          <div v-e="['c:interface:grid:record:duplicate']" class="text-bodyDefaultSm flex gap-2 items-center">
            <GeneralIcon icon="duplicate" />
            {{ $t('labels.duplicateRecord') }}
          </div>
        </NcMenuItem>
        <NcMenuItem
          v-if="contextMenuRow !== null && contextMenuPath !== null && interfaceClickIntoDetails"
          key="interface-expand-record"
          class="nc-base-menu-item"
          data-testid="context-menu-item-interface-expand"
          @click="interfaceExpandRecord"
        >
          <div v-e="['c:interface:grid:record:expand']" class="text-bodyDefaultSm flex gap-2 items-center">
            <GeneralIcon icon="maximize" />
            {{ $t('activity.expandRecord') }}
          </div>
        </NcMenuItem>
        <template v-if="contextMenuRowId">
          <NcDivider
            v-if="
              contextMenuRow !== null &&
              contextMenuPath !== null &&
              ((canAddDeleteRows && !isDataReadOnly && !isSyncedTable) || interfaceClickIntoDetails)
            "
          />
          <NcMenuItem
            key="interface-copy-record-url"
            class="nc-base-menu-item"
            data-testid="context-menu-item-interface-copy-url"
            @click="interfaceCopyRecordUrl"
          >
            <div v-e="['c:interface:grid:record:copy-url']" class="text-bodyDefaultSm flex gap-2 items-center">
              <GeneralIcon icon="ncLink" />
              {{ $t('labels.copyRecordURL') }}
            </div>
          </NcMenuItem>
        </template>
        <template
          v-if="canAddDeleteRows && !isDataReadOnly && !isSyncedTable && contextMenuRow !== null && contextMenuPath !== null"
        >
          <NcDivider />
          <NcMenuItem
            key="interface-delete-record"
            class="nc-base-menu-item"
            danger
            data-testid="context-menu-item-interface-delete"
            @click="confirmDeleteRow(contextMenuRow, contextMenuPath)"
          >
            <div v-e="['c:interface:grid:record:delete']" class="text-bodyDefaultSm flex gap-2 items-center">
              <GeneralIcon icon="delete" />
              {{ $t('activity.deleteRow') }}
            </div>
          </NcMenuItem>
        </template>
      </template>
    </template>
    <template v-else>
      <template v-if="!vSelectedAllRecords">
        <NcTooltip
          v-if="
            appInfo.ee &&
            contextMenuCol == null &&
            contextMenuPath !== null &&
            !isDataReadOnly &&
            selectedRows.length &&
            isSyncedTable
          "
          placement="left"
        >
          <template #title>
            {{ $t('msg.info.updateNotAvailableForSyncedTable') }}
          </template>
          <NcMenuItem key="update-selected-rows" disabled @click="emits('bulkUpdateDlg', contextMenuPath)">
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="ncEdit" />
              {{ $t('title.updateSelectedRows') }}
            </div>
          </NcMenuItem>
        </NcTooltip>
        <NcMenuItem
          v-else-if="appInfo.ee && contextMenuCol == null && contextMenuPath !== null && !isDataReadOnly && selectedRows.length"
          key="update-selected-rows"
          @click="emits('bulkUpdateDlg', contextMenuPath)"
        >
          <div v-e="['a:row:update-bulk']" class="flex gap-2 items-center">
            <GeneralIcon icon="ncEdit" />
            {{ $t('title.updateSelectedRows') }}
          </div>
        </NcMenuItem>

        <PermissionsTooltip
          v-if="contextMenuCol == null && !isDataReadOnly && contextMenuPath !== null && selectedRows.length && canAddDeleteRows"
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_DELETE"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcTooltip v-if="isSyncedTable" placement="left">
              <template #title>
                {{ $t('msg.info.deleteNotAvailableForSyncedTable') }}
              </template>
              <NcMenuItem
                key="selete-selected-rows"
                class="nc-base-menu-item"
                danger
                disabled
                data-testid="nc-delete-row"
                @click="deleteSelectedRows(contextMenuPath)"
              >
                <div v-if="selectedRows.length === 1" class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" />
                  {{ $t('activity.deleteSelectedRow') }}
                </div>
                <div v-else class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" />
                  {{ $t('activity.deleteSelectedRow') }}
                </div>
              </NcMenuItem>
            </NcTooltip>
            <NcMenuItem
              v-else
              key="delete-selected-rows"
              class="nc-base-menu-item"
              danger
              data-testid="nc-delete-row"
              :disabled="!isAllowed"
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
        </PermissionsTooltip>
      </template>
      <PermissionsTooltip
        v-if="vSelectedAllRecords && !isGroupBy && canAddDeleteRows"
        :entity="PermissionEntity.TABLE"
        :entity-id="meta?.id"
        :permission="PermissionKey.TABLE_RECORD_DELETE"
        placement="right"
      >
        <template #default="{ isAllowed }">
          <NcTooltip v-if="isSyncedTable" placement="left">
            <template #title>
              {{ $t('msg.info.deleteNotAvailableForSyncedTable') }}
            </template>
            <NcMenuItem
              key="delete-all-rows"
              class="nc-base-menu-item"
              danger
              disabled
              data-testid="nc-delete-all-row"
              @click="deleteAllRecords(contextMenuPath)"
            >
              <div class="flex gap-2 items-center">
                <GeneralIcon icon="delete" />
                {{
                  ncIsEmptyObject(vSelectedAllRecordsSkipPks)
                    ? $t('activity.deleteAllRecords')
                    : $t('activity.deleteAllSelectedRecords')
                }}
              </div>
            </NcMenuItem>
          </NcTooltip>
          <NcMenuItem
            v-else
            key="delete-all-rows"
            class="nc-base-menu-item"
            danger
            data-testid="nc-delete-all-row"
            :disabled="!isAllowed"
            @click="deleteAllRecords(contextMenuPath)"
          >
            <div v-e="['a:row:delete-all']" class="flex gap-2 items-center">
              <GeneralIcon icon="delete" />
              {{
                ncIsEmptyObject(vSelectedAllRecordsSkipPks)
                  ? $t('activity.deleteAllRecords')
                  : $t('activity.deleteAllSelectedRecords')
              }}
            </div>
          </NcMenuItem>
        </template>
      </PermissionsTooltip>

      <template
        v-if="isOrderColumnExists && !isDataReadOnly && isPrimaryKeyAvailable && selection.isSingleCell() && canAddDeleteRows"
      >
        <PermissionsTooltip
          v-if="contextMenuCol !== null && contextMenuRow !== null && contextMenuPath !== null"
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_ADD"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcTooltip v-if="isSyncedTable" placement="left">
              <template #title>
                {{ $t('msg.info.insertNotAvailableForSyncedTable') }}
              </template>
              <NcMenuItem
                key="insert-above"
                class="nc-base-menu-item"
                disabled
                data-testid="context-menu-item-add-above"
                @click="callAddNewRow(contextMenuTarget, 'above')"
              >
                <div class="flex gap-2 items-center">
                  <GeneralIcon icon="ncChevronUp" />
                  {{ $t('general.insertAbove') }}
                </div>
              </NcMenuItem>
            </NcTooltip>
            <NcMenuItem
              v-else
              key="insert-above"
              class="nc-base-menu-item"
              data-testid="context-menu-item-add-above"
              :disabled="!isAllowed"
              @click="callAddNewRow(contextMenuTarget, 'above')"
            >
              <div v-e="['a:row:insert:above']" class="flex gap-2 items-center">
                <GeneralIcon icon="ncChevronUp" />
                {{ $t('general.insertAbove') }}
              </div>
            </NcMenuItem>
          </template>
        </PermissionsTooltip>
        <PermissionsTooltip
          v-if="
            contextMenuCol !== null &&
            contextMenuRow !== null &&
            contextMenuPath !== null &&
            !isInsertBelowDisabled &&
            canAddDeleteRows
          "
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_ADD"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcTooltip v-if="isSyncedTable" placement="left">
              <template #title>
                {{ $t('msg.info.insertNotAvailableForSyncedTable') }}
              </template>
              <NcMenuItem
                key="insert-below"
                class="nc-base-menu-item"
                disabled
                data-testid="context-menu-item-add-below"
                @click="callAddNewRow(contextMenuTarget, 'below')"
              >
                <div class="flex gap-2 items-center">
                  <GeneralIcon icon="ncChevronDown" />
                  {{ $t('general.insertBelow') }}
                </div>
              </NcMenuItem>
            </NcTooltip>
            <NcMenuItem
              v-else
              key="insert-below"
              class="nc-base-menu-item"
              data-testid="context-menu-item-add-below"
              :disabled="!isAllowed"
              @click="callAddNewRow(contextMenuTarget, 'below')"
            >
              <div v-e="['a:row:insert:below']" class="flex gap-2 items-center">
                <GeneralIcon icon="ncChevronDown" />
                {{ $t('general.insertBelow') }}
              </div>
            </NcMenuItem>
          </template>
        </PermissionsTooltip>
        <PermissionsTooltip
          v-if="contextMenuCol !== null && contextMenuRow !== null && contextMenuPath !== null"
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_ADD"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcTooltip v-if="isSyncedTable" placement="left">
              <template #title>
                {{ $t('msg.info.duplicateNotAvailableForSyncedTable') }}
              </template>
              <NcMenuItem key="duplicate-row" class="nc-base-menu-item" disabled data-testid="context-menu-item-duplicate-row">
                <div class="flex gap-2 items-center">
                  <GeneralIcon icon="duplicate" />
                  {{ $t('labels.duplicateRecord') }}
                </div>
              </NcMenuItem>
            </NcTooltip>
            <NcMenuItem
              v-else
              key="duplicate-row"
              class="nc-base-menu-item"
              data-testid="context-menu-item-duplicate-row"
              :disabled="!isAllowed"
              @click="duplicateRow(contextMenuTarget)"
            >
              <div v-e="['a:row:duplicate']" class="flex gap-2 items-center">
                <GeneralIcon icon="duplicate" />
                {{ $t('labels.duplicateRecord') }}
              </div>
            </NcMenuItem>
          </template>
        </PermissionsTooltip>
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
          theme="ai"
          @click="execBulkAction(contextMenuPath || [])"
        >
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
            {{ $t('labels.generateType', { type: selection.isSingleCell() ? $t('objects.cell') : $t('general.all') }) }}
          </div>
        </NcMenuItem>
      </NcTooltip>

      <NcMenuItem
        v-if="isSelectionOnlyScript.enabled"
        key="execute-script"
        class="nc-base-menu-item"
        data-testid="context-menu-item-bulk-script"
        :disabled="isSelectionOnlyScript.disabled"
        @click="execBulkAction(contextMenuPath || [])"
      >
        <div class="flex gap-2 items-center">
          <GeneralIcon icon="ncScript" class="h-4 w-4" />
          {{ $t('labels.executeType', { type: selection.isSingleCell() ? $t('objects.cell') : $t('general.all') }) }}
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

      <PermissionsTooltip
        v-if="contextMenuCol !== null && contextMenuPath && contextMenuRow !== null && hasEditPermission && !isDataReadOnly"
        :entity="PermissionEntity.FIELD"
        :entity-id="columns[contextMenuCol]?.columnObj?.id"
        :permission="PermissionKey.RECORD_FIELD_EDIT"
        placement="right"
      >
        <template #default="{ isAllowed }">
          <NcTooltip v-if="isSyncedTable" placement="left">
            <template #title>
              {{ $t('msg.info.pasteNotAvailableForSyncedTable') }}
            </template>
            <NcMenuItem key="cell-paste" class="nc-base-menu-item" disabled data-testid="context-menu-item-paste" @click="paste">
              <div class="flex gap-2 items-center">
                <GeneralIcon icon="paste" />
                {{ $t('general.paste') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>
          </NcTooltip>
          <NcMenuItem
            v-else
            key="cell-paste"
            class="nc-base-menu-item"
            data-testid="context-menu-item-paste"
            :disabled="disablePasteCell || !isAllowed"
            @click="paste"
          >
            <div v-e="['a:row:paste']" class="flex gap-2 items-center">
              <GeneralIcon icon="paste" />
              <!-- Paste -->
              {{ $t('general.paste') }} {{ $t('objects.cell').toLowerCase() }}
            </div>
          </NcMenuItem>
        </template>
      </PermissionsTooltip>

      <PermissionsTooltip
        v-if="
          contextMenuCol !== null && contextMenuRow !== null && contextMenuPath !== null && hasEditPermission && !isDataReadOnly
        "
        :entity="PermissionEntity.FIELD"
        :entity-id="columns[contextMenuCol]?.columnObj?.id"
        :permission="PermissionKey.RECORD_FIELD_EDIT"
        placement="right"
      >
        <template #default="{ isAllowed }">
          <NcTooltip v-if="isSyncedTable" placement="left">
            <template #title>
              {{ $t('msg.info.clearNotAvailableForSyncedTable') }}
            </template>
            <NcMenuItem
              v-if="selection.isSingleCell() && ((columns[contextMenuCol]?.columnObj && isLinksOrLTAR(columns[contextMenuCol]?.columnObj!)) || !columns[contextMenuCol]?.virtual)"
              key="cell-clear"
              class="nc-base-menu-item"
              disabled
              data-testid="context-menu-item-clear"
              @click="clearCell(contextMenuTarget)"
            >
              <div class="flex gap-2 items-center">
                <GeneralIcon icon="close" />
                {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>
            <NcMenuItem
              v-else
              key="cells-clear"
              class="nc-base-menu-item"
              disabled
              data-testid="context-menu-item-clear"
              @click="clearSelectedRangeOfCells(contextMenuPath)"
            >
              <div class="flex gap-2 items-center">
                <GeneralIcon icon="closeBox" class="text-nc-content-gray-muted" />
                {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>
          </NcTooltip>
          <template v-else>
            <NcMenuItem
              v-if="selection.isSingleCell() && ((columns[contextMenuCol]?.columnObj && isLinksOrLTAR(columns[contextMenuCol]?.columnObj!)) || !columns[contextMenuCol]?.virtual)"
              key="cell-clear"
              class="nc-base-menu-item"
              :disabled="disableClearCell || !isAllowed"
              data-testid="context-menu-item-clear"
              @click="clearCell(contextMenuTarget)"
            >
              <div v-e="['a:row:clear']" class="flex gap-2 items-center">
                <GeneralIcon icon="close" />
                {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>
            <NcMenuItem
              v-else
              key="cells-clear"
              class="nc-base-menu-item"
              :disabled="isSelectionReadOnly || !isAllowed"
              data-testid="context-menu-item-clear"
              @click="clearSelectedRangeOfCells(contextMenuPath)"
            >
              <div v-e="['a:row:clear-range']" class="flex gap-2 items-center">
                <GeneralIcon icon="closeBox" class="text-nc-content-gray-muted" />
                {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>
          </template>
        </template>
      </PermissionsTooltip>

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
        <NcMenuItem
          v-if="appInfo.ee && contextMenuRowId && !isPublic"
          key="send-record"
          class="nc-base-menu-item"
          @click="emits('sendRecord', contextMenuRowId)"
        >
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="mail" class="h-4 w-4" />
            {{ $t('activity.sendRecord') }}
          </div>
        </NcMenuItem>
      </template>

      <template
        v-if="
          isAiRecordContextEnabled &&
          contextMenuRowId &&
          contextMenuPath !== null &&
          contextMenuRow !== null &&
          selection.isSingleCell() &&
          !isPublic
        "
      >
        <NcDivider />
        <NcMenuItem
          key="ask-ai-about-record"
          class="nc-base-menu-item"
          data-testid="nc-grid-context-ask-ai"
          @click="askAiAboutRecord"
        >
          <div v-e="['c:row:ask-ai']" class="flex gap-2 items-center">
            <GeneralIcon icon="ncAutoAwesome" class="text-nc-content-brand" />
            {{ $t('labels.askAiAboutRecord') }}
          </div>
        </NcMenuItem>
      </template>

      <template v-if="!isDataReadOnly && canAddDeleteRows">
        <NcDivider v-if="!(!contextMenuCol !== null && (selectedRows.length || vSelectedAllRecords))" />
        <PermissionsTooltip
          v-if="contextMenuPath !== null && contextMenuCol !== null && contextMenuRow != null"
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_DELETE"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcTooltip v-if="isSyncedTable" placement="left">
              <template #title>
                {{ $t('msg.info.deleteNotAvailableForSyncedTable') }}
              </template>
              <NcMenuItem
                v-if="selection.isSingleCell() || selection.isSingleRow()"
                key="delete-row"
                class="nc-base-menu-item"
                danger
                disabled
                @click="confirmDeleteRow(contextMenuRow, contextMenuPath)"
              >
                <div class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" />
                  {{ $t('activity.deleteRow') }}
                </div>
              </NcMenuItem>
              <NcMenuItem
                v-else
                key="delete-selected-row"
                class="nc-base-menu-item"
                danger
                disabled
                @click="deleteSelectedRangeOfRows(contextMenuPath)"
              >
                <div class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" />
                  {{ $t('activity.deleteRows') }}
                </div>
              </NcMenuItem>
            </NcTooltip>
            <template v-else>
              <NcMenuItem
                v-if="selection.isSingleCell() || selection.isSingleRow()"
                key="delete-row"
                class="nc-base-menu-item"
                danger
                :disabled="!isAllowed"
                @click="confirmDeleteRow(contextMenuRow, contextMenuPath)"
              >
                <div v-e="['a:row:delete']" class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" />
                  <!-- Delete Row -->
                  {{ $t('activity.deleteRow') }}
                </div>
              </NcMenuItem>
              <NcMenuItem
                v-else
                key="delete-selected-row"
                class="nc-base-menu-item"
                danger
                :disabled="!isAllowed"
                @click="deleteSelectedRangeOfRows(contextMenuPath)"
              >
                <div v-e="['a:row:delete']" class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" />
                  <!-- Delete Rows -->
                  {{ $t('activity.deleteRows') }}
                </div>
              </NcMenuItem>
            </template>
          </template>
        </PermissionsTooltip>
      </template>
    </template>
  </NcMenu>
</template>

<style scoped lang="scss">
// `.nc-menu-item-inner` carries its own `text-sm`, so the size must land there.
.nc-interface-record-context-menu {
  :deep(.nc-menu-item-inner) {
    @apply text-[13px];

    svg {
      @apply w-3.5 h-3.5;
    }
  }
}
</style>
