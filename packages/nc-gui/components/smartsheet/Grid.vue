<script lang="ts" setup>
import { nextTick } from '@vue/runtime-core'
import type { ColumnReqType, ColumnType, GridType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  CellUrlDisableOverlayInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  IsLockedInj,
  MetaInj,
  NavigateDir,
  OpenNewRecordFormHookInj,
  PaginationDataInj,
  ReadonlyInj,
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  RowHeightInj,
  SmartsheetStoreEvents,
  computed,
  createEventHook,
  enumColor,
  extractPkFromRow,
  iconMap,
  inject,
  isColumnRequiredAndNull,
  isDrawerOrModalExist,
  isMac,
  message,
  onBeforeUnmount,
  onClickOutside,
  onMounted,
  provide,
  ref,
  useEventListener,
  useGridViewColumnWidth,
  useI18n,
  useMetas,
  useMultiSelect,
  useNuxtApp,
  useRoles,
  useRoute,
  useSmartsheetStoreOrThrow,
  useUIPermission,
  useUndoRedo,
  useViewData,
  watch,
} from '#imports'
import type { Row } from '~/lib'

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { $api, $e } = useNuxtApp()

// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const fields = inject(FieldsInj, ref([]))
const readOnly = inject(ReadonlyInj, ref(false))
const isLocked = inject(IsLockedInj, ref(false))

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const { hasRole } = useRoles()
const { isUIAllowed } = useUIPermission()
const hasEditPermission = $computed(() => isUIAllowed('xcDatatableEditable'))

const router = useRouter()

const route = $(router.currentRoute)

const { addUndo, clone, defineViewScope } = useUndoRedo()

// todo: get from parent ( inject or use prop )
const isView = false

let editEnabled = $ref(false)

const { appInfo } = useGlobal()

const { xWhere, isPkAvail, isSqlView, eventBus } = useSmartsheetStoreOrThrow()

const visibleColLength = $computed(() => fields.value?.length)

const addColumnDropdown = ref(false)

const _contextMenu = ref(false)
const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    if (hasEditPermission) {
      _contextMenu.value = val
    }
  },
})
const contextMenuClosing = ref(false)

const bulkUpdateDlg = ref(false)

const routeQuery = $computed(() => route.query as Record<string, string>)
const contextMenuTarget = ref<{ row: number; col: number } | null>(null)
const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()
const gridWrapper = ref<HTMLElement>()
const tableHeadEl = ref<HTMLElement>()
const tableBodyEl = ref<HTMLElement>()

const isAddingColumnAllowed = $computed(() => !readOnly.value && !isLocked.value && isUIAllowed('add-column') && !isSqlView.value)

const isAddingEmptyRowAllowed = $computed(() => !isView && !isLocked.value && hasEditPermission && !isSqlView.value)

const {
  isLoading,
  loadData,
  paginationData,
  formattedData: data,
  updateOrSaveRow,
  changePage,
  addEmptyRow: _addEmptyRow,
  deleteRow,
  deleteSelectedRows,
  selectedAllRecords,
  removeRowIfNew,
  navigateToSiblingRow,
  getExpandedRowIndex,
  deleteRangeOfRows,
  bulkUpdateRows,
  bulkUpdateView,
} = useViewData(meta, view, xWhere)

const { getMeta } = useMetas()

const { loadGridViewColumns, updateWidth, resizingColWidth, resizingCol } = useGridViewColumnWidth(view)

const getContainerScrollForElement = (
  el: HTMLElement,
  container: HTMLElement,
  offset?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  },
) => {
  const childPos = el.getBoundingClientRect()
  const parentPos = container.getBoundingClientRect()

  // provide an extra offset to show the prev/next/up/bottom cell
  const extraOffset = 15

  const numColWidth = container.querySelector('thead th:nth-child(1)')?.getBoundingClientRect().width ?? 0
  const primaryColWidth = container.querySelector('thead th:nth-child(2)')?.getBoundingClientRect().width ?? 0

  const stickyColsWidth = numColWidth + primaryColWidth

  const relativePos = {
    top: childPos.top - parentPos.top,
    right: childPos.right - parentPos.right,
    bottom: childPos.bottom - parentPos.bottom,
    left: childPos.left - parentPos.left - stickyColsWidth,
  }

  const scroll = {
    top: 0,
    left: 0,
  }

  /*
   * If the element is to the right of the container, scroll right (positive)
   * If the element is to the left of the container, scroll left (negative)
   */
  scroll.left =
    relativePos.right + (offset?.right || 0) > 0
      ? container.scrollLeft + relativePos.right + (offset?.right || 0) + extraOffset
      : relativePos.left - (offset?.left || 0) < 0
      ? container.scrollLeft + relativePos.left - (offset?.left || 0) - extraOffset
      : container.scrollLeft

  /*
   * If the element is below the container, scroll down (positive)
   * If the element is above the container, scroll up (negative)
   */
  scroll.top =
    relativePos.bottom + (offset?.bottom || 0) > 0
      ? container.scrollTop + relativePos.bottom + (offset?.bottom || 0) + extraOffset
      : relativePos.top - (offset?.top || 0) < 0
      ? container.scrollTop + relativePos.top - (offset?.top || 0) - extraOffset
      : container.scrollTop

  return scroll
}

const {
  isCellSelected,
  activeCell,
  handleMouseDown,
  handleMouseOver,
  handleCellClick,
  clearSelectedRange,
  copyValue,
  isCellActive,
  resetSelectedRange,
  makeActive,
  selectedRange,
} = useMultiSelect(
  meta,
  fields,
  data,
  $$(editEnabled),
  isPkAvail,
  contextMenu,
  clearCell,
  clearSelectedRangeOfCells,
  makeEditable,
  scrollToCell,
  (e: KeyboardEvent) => {
    // ignore navigating if picker(Date, Time, DateTime, Year)
    // or single/multi select options is open
    const activePickerOrDropdownEl = document.querySelector(
      '.nc-picker-datetime.active,.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active,.nc-picker-date.active,.nc-picker-year.active,.nc-picker-time.active',
    )
    if (activePickerOrDropdownEl) {
      e.preventDefault()
      return true
    }

    // skip keyboard event handling if there is a drawer / modal
    if (isDrawerOrModalExist()) {
      return true
    }

    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
    const altOrOptionKey = e.altKey
    if (e.key === ' ') {
      if (isCellActive.value && !editEnabled && hasEditPermission) {
        e.preventDefault()
        const row = data.value[activeCell.row]
        expandForm(row)
        return true
      }
    } else if (e.key === 'Escape') {
      if (editEnabled) {
        editEnabled = false
        return true
      }
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // add a line break for types like LongText / JSON
        return true
      }
      if (editEnabled) {
        editEnabled = false
        return true
      }
    }

    if (cmdOrCtrl) {
      if (!isCellActive.value) return

      // cmdOrCtrl+shift handled in useMultiSelect
      if (e.shiftKey) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = 0
          activeCell.col = activeCell.col ?? 0
          scrollToCell?.()
          editEnabled = false
          return true
        case 'ArrowDown':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = data.value.length - 1
          activeCell.col = activeCell.col ?? 0
          scrollToCell?.()
          editEnabled = false
          return true
        case 'ArrowRight':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = fields.value?.length - 1
          scrollToCell?.()
          editEnabled = false
          return true
        case 'ArrowLeft':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = 0
          scrollToCell?.()
          editEnabled = false
          return true
      }
    }

    if (altOrOptionKey) {
      switch (e.keyCode) {
        case 82: {
          // ALT + R
          if (isAddingEmptyRowAllowed) {
            $e('c:shortcut', { key: 'ALT + R' })
            addEmptyRow()
            activeCell.row = data.value.length - 1
            activeCell.col = 0
            resetSelectedRange()
            nextTick(() => {
              ;(document.querySelector('td.cell.active') as HTMLInputElement | HTMLTextAreaElement)?.scrollIntoView({
                behavior: 'smooth',
              })
            })
          }
          break
        }
        case 67: {
          // ALT + C
          if (isAddingColumnAllowed) {
            $e('c:shortcut', { key: 'ALT + C' })
            addColumnDropdown.value = true
          }
          break
        }
      }
    }
  },
  async (ctx: { row: number; col?: number; updatedColumnTitle?: string }) => {
    const rowObj = data.value[ctx.row]
    const columnObj = ctx.col !== undefined ? fields.value[ctx.col] : null

    if (!ctx.updatedColumnTitle && isVirtualCol(columnObj)) {
      return
    }

    // See DateTimePicker.vue for details
    data.value[ctx.row].rowMeta.isUpdatedFromCopyNPaste = {
      ...data.value[ctx.row].rowMeta.isUpdatedFromCopyNPaste,
      [ctx.updatedColumnTitle || columnObj.title]: true,
    }

    // update/save cell value
    await updateOrSaveRow(rowObj, ctx.updatedColumnTitle || columnObj.title)
  },
  bulkUpdateRows,
)

function scrollToCell(row?: number | null, col?: number | null) {
  row = row ?? activeCell.row
  col = col ?? activeCell.col

  if (row !== null && col !== null) {
    // get active cell
    const rows = tableBodyEl.value?.querySelectorAll('tr')
    const cols = rows?.[row]?.querySelectorAll('td')
    const td = cols?.[col === 0 ? 0 : col + 1]

    if (!td || !gridWrapper.value) return

    const { height: headerHeight } = tableHeadEl.value!.getBoundingClientRect()
    const tdScroll = getContainerScrollForElement(td, gridWrapper.value, { top: headerHeight, bottom: 9, right: 9 })

    // if first column set left to 0 since it's sticky it will be visible and calculated value will be wrong
    // setting left to 0 will make it scroll to the left
    if (col === 0) {
      tdScroll.left = 0
    }

    if (rows && row === rows.length - 2) {
      // if last row make 'Add New Row' visible
      gridWrapper.value.scrollTo({
        top: gridWrapper.value.scrollHeight,
        left:
          cols && col === cols.length - 2 // if corner cell
            ? gridWrapper.value.scrollWidth
            : tdScroll.left,
        behavior: 'smooth',
      })
      return
    }

    if (cols && col === cols.length - 2) {
      // if last column make 'Add New Column' visible
      gridWrapper.value.scrollTo({
        top: tdScroll.top,
        left: gridWrapper.value.scrollWidth,
        behavior: 'smooth',
      })
      return
    }

    // scroll into the active cell
    gridWrapper.value.scrollTo({
      top: tdScroll.top,
      left: tdScroll.left,
      behavior: 'smooth',
    })
  }
}

const rowHeight = computed(() => {
  if ((view.value?.view as GridType)?.row_height !== undefined) {
    switch ((view.value?.view as GridType)?.row_height) {
      case 0:
        return 1
      case 1:
        return 2
      case 2:
        return 4
      case 3:
        return 6
      default:
        return 1
    }
  }
})

onMounted(loadGridViewColumns)

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(true))

provide(PaginationDataInj, paginationData)

provide(ChangePageInj, changePage)

provide(RowHeightInj, rowHeight)

const disableUrlOverlay = ref(false)
provide(CellUrlDisableOverlayInj, disableUrlOverlay)

const showLoading = ref(true)

const skipRowRemovalOnCancel = ref(false)

const preloadColumn = ref<Partial<any>>()

function expandForm(row: Row, state?: Record<string, any>, fromToolbar = false) {
  const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])

  if (rowId) {
    router.push({
      query: {
        ...routeQuery,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormRowState.value = state
    expandedFormDlg.value = true
    skipRowRemovalOnCancel.value = !fromToolbar
  }
}

const onresize = (colID: string, event: any) => {
  updateWidth(colID, event.detail)
}

const onXcResizing = (cn: string, event: any) => {
  resizingCol.value = cn
  resizingColWidth.value = event.detail
}

defineExpose({
  loadData,
  openColumnCreate: (data) => {
    tableHeadEl.value?.querySelector('th:last-child')?.scrollIntoView({ behavior: 'smooth' })
    setTimeout(() => {
      addColumnDropdown.value = true
      preloadColumn.value = data
    }, 500)
  },
})

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuClosing.value = true
    contextMenuTarget.value = null
  } else {
    contextMenuClosing.value = false
  }
})

const rowRefs = $ref<any[]>()

async function clearCell(ctx: { row: number; col: number } | null, skipUpdate = false) {
  if (
    !ctx ||
    !hasEditPermission ||
    (fields.value[ctx.col].uidt !== UITypes.LinkToAnotherRecord && isVirtualCol(fields.value[ctx.col]))
  )
    return

  const rowObj = data.value[ctx.row]
  const columnObj = fields.value[ctx.col]

  if (isVirtualCol(columnObj)) {
    addUndo({
      undo: {
        fn: async (ctx: { row: number; col: number }, col: ColumnType, row: Row, pg: PaginatedType) => {
          if (paginationData.value.pageSize === pg.pageSize) {
            if (paginationData.value.page !== pg.page) {
              await changePage(pg.page!)
            }
            const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            const rowObj = data.value[ctx.row]
            const columnObj = fields.value[ctx.col]
            if (
              columnObj.title &&
              rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) &&
              columnObj.id === col.id
            ) {
              rowObj.row[columnObj.title] = row.row[columnObj.title]
              await rowRefs[ctx.row]!.addLTARRef(rowObj.row[columnObj.title], columnObj)
              await rowRefs[ctx.row]!.syncLTARRefs(rowObj.row)
              activeCell.col = ctx.col
              activeCell.row = ctx.row
              scrollToCell?.()
            } else {
              throw new Error('Record could not be found')
            }
          } else {
            throw new Error('Page size changed')
          }
        },
        args: [clone(ctx), clone(columnObj), clone(rowObj), clone(paginationData.value)],
      },
      redo: {
        fn: async (ctx: { row: number; col: number }, col: ColumnType, row: Row, pg: PaginatedType) => {
          if (paginationData.value.pageSize === pg.pageSize) {
            if (paginationData.value.page !== pg.page) {
              await changePage(pg.page!)
            }
            const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            const rowObj = data.value[ctx.row]
            const columnObj = fields.value[ctx.col]
            if (rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) && columnObj.id === col.id) {
              await rowRefs[ctx.row]!.clearLTARCell(columnObj)
              activeCell.col = ctx.col
              activeCell.row = ctx.row
              scrollToCell?.()
            } else {
              throw new Error('Record could not be found')
            }
          } else {
            throw new Error('Page size changed')
          }
        },
        args: [clone(ctx), clone(columnObj), clone(rowObj), clone(paginationData.value)],
      },
      scope: defineViewScope({ view: view.value }),
    })
    await rowRefs[ctx.row]!.clearLTARCell(columnObj)
    return
  }

  // handle Checkbox and rating fields in a special way
  switch (columnObj.uidt) {
    case UITypes.Checkbox:
      rowObj.row[columnObj.title] = false
      break
    case UITypes.Rating:
      rowObj.row[columnObj.title] = 0
      break
    default:
      rowObj.row[columnObj.title] = null
      break
  }

  if (!skipUpdate) {
    // update/save cell value
    await updateOrSaveRow(rowObj, columnObj.title)
  }
}

async function clearSelectedRangeOfCells() {
  if (!hasEditPermission) return

  const start = selectedRange.start
  const end = selectedRange.end

  const startRow = Math.min(start.row, end.row)
  const endRow = Math.max(start.row, end.row)
  const startCol = Math.min(start.col, end.col)
  const endCol = Math.max(start.col, end.col)

  const cols = fields.value.slice(startCol, endCol + 1)
  const rows = data.value.slice(startRow, endRow + 1)
  const props = []

  for (const row of rows) {
    for (const col of cols) {
      if (!row || !col || !col.title) continue

      // TODO handle LinkToAnotherRecord
      if (isVirtualCol(col)) continue

      row.row[col.title] = null
      props.push(col.title)
    }
  }

  await bulkUpdateRows(rows, props)
}

function makeEditable(row: Row, col: ColumnType) {
  if (!hasEditPermission || editEnabled || isView || isLocked.value || readOnly.value || isSystemColumn(col)) {
    return
  }

  if (!isPkAvail.value && !row.rowMeta.new) {
    // Update not allowed for table which doesn't have primary Key
    message.info(t('msg.info.updateNotAllowedWithoutPK'))
    return
  }

  if (col.ai) {
    // Auto Increment field is not editable
    message.info(t('msg.info.autoIncFieldNotEditable'))
    return
  }

  if (col.pk && !row.rowMeta.new) {
    // Editing primary key not supported
    message.info(t('msg.info.editingPKnotSupported'))
    return
  }

  if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(col.uidt as UITypes)) {
    return
  }

  return (editEnabled = true)
}

const altModifier = ref(false)

const persistMenu = ref(false)

/** handle keypress events */
useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  if (e.key === 'Alt') {
    altModifier.value = true
  }
})

/** handle keypress events */
useEventListener(document, 'keyup', async (e: KeyboardEvent) => {
  if (e.key === 'Alt') {
    altModifier.value = false
    disableUrlOverlay.value = false
  }
})

/** On clicking outside of table reset active cell  */
const smartTable = ref(null)

onClickOutside(tableBodyEl, (e) => {
  // do nothing if context menu was open
  if (contextMenu.value) return

  if (activeCell.row === null || activeCell.col === null) return

  const activeCol = fields.value[activeCell.col]

  if (editEnabled && (isVirtualCol(activeCol) || activeCol.uidt === UITypes.JSON)) return

  // ignore unselecting if clicked inside or on the picker(Date, Time, DateTime, Year)
  // or single/multi select options
  const activePickerOrDropdownEl = document.querySelector(
    '.nc-picker-datetime.active,.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active,.nc-picker-date.active,.nc-picker-year.active,.nc-picker-time.active',
  )
  if (
    e.target &&
    activePickerOrDropdownEl &&
    (activePickerOrDropdownEl === e.target || activePickerOrDropdownEl?.contains(e.target as Element))
  )
    return

  // skip if drawer / modal is active
  if (isDrawerOrModalExist()) {
    return
  }

  clearSelectedRange()
  activeCell.row = null
  activeCell.col = null
})

const onNavigate = (dir: NavigateDir) => {
  if (activeCell.row === null || activeCell.col === null) return

  editEnabled = false
  clearSelectedRange()

  switch (dir) {
    case NavigateDir.NEXT:
      if (activeCell.row < data.value.length - 1) {
        activeCell.row++
      } else {
        addEmptyRow()
        activeCell.row++
      }
      break
    case NavigateDir.PREV:
      if (activeCell.row > 0) {
        activeCell.row--
      }
      break
  }
  nextTick(() => {
    scrollToCell()
  })
}

const showContextMenu = (e: MouseEvent, target?: { row: number; col: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const saveOrUpdateRecords = async (args: { metaValue?: TableType; viewMetaValue?: ViewType; data?: any } = {}) => {
  let index = -1
  for (const currentRow of args.data || data.value) {
    index++
    /** if new record save row and save the LTAR cells */
    if (currentRow.rowMeta.new) {
      const syncLTARRefs = rowRefs?.[index]?.syncLTARRefs
      const savedRow = await updateOrSaveRow(currentRow, '', {}, args)
      await syncLTARRefs?.(savedRow, args)
      currentRow.rowMeta.changed = false
      continue
    }

    /** if existing row check updated cell and invoke update method */
    if (currentRow.rowMeta.changed) {
      currentRow.rowMeta.changed = false
      for (const field of (args.metaValue || meta.value)?.columns ?? []) {
        // `url` would be enriched in attachment during listing
        // hence it would consider as a change while it is not necessary to update
        if (isVirtualCol(field) || field.uidt === UITypes.Attachment) continue
        if (field.title! in currentRow.row && currentRow.row[field.title!] !== currentRow.oldRow[field.title!]) {
          await updateOrSaveRow(currentRow, field.title!, {}, args)
        }
      }
    }
  }
}

const predictingNextColumn = ref(false)

const predictedNextColumn = ref<Array<{ title: string; type: string }>>()

const predictingNextFormulas = ref(false)

const predictedNextFormulas = ref<Array<{ title: string; formula: string }>>()

const predictNextColumn = async () => {
  if (predictingNextColumn.value) return
  predictedNextColumn.value = []
  predictingNextColumn.value = true
  try {
    if (meta.value && meta.value.columns) {
      const res: { data: Array<{ title: string; type: string }> } = await $api.utils.magic({
        operation: 'predictNextColumn',
        data: {
          table: meta.value.title,
          columns: meta.value.columns.map((col) => col.title),
        },
      })

      predictedNextColumn.value = res.data
    }
  } catch (e) {
    message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
  }
  predictingNextColumn.value = false
}

const predictNextFormulas = async () => {
  if (predictingNextFormulas.value) return
  predictingNextFormulas.value = true
  try {
    if (meta.value && meta.value.columns) {
      const res: { data: Array<{ title: string; formula: string }> } = await $api.utils.magic({
        operation: 'predictNextFormulas',
        data: {
          table: meta.value.title,
          columns: meta.value.columns
            .filter((c) => {
              // skip system LTAR columns
              if (c.uidt === UITypes.LinkToAnotherRecord && c.system) return false
              if ([UITypes.QrCode, UITypes.Barcode].includes(c.uidt as UITypes)) return false
              return true
            })
            .map((col) => col.title),
        },
      })

      predictedNextFormulas.value = res.data
    }
  } catch (e) {
    message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
  }
  predictingNextFormulas.value = false
}

const loadColumn = (title: string, tp: string, colOptions?: any) => {
  preloadColumn.value = {
    title,
    uidt: tp,
    colOptions,
  }
  persistMenu.value = false
}

async function reloadViewDataHandler(shouldShowLoading: boolean | void) {
  if (predictedNextColumn.value?.length) {
    const fieldsAvailable = meta.value?.columns?.map((c) => c.title)
    predictedNextColumn.value = predictedNextColumn.value.filter((c) => !fieldsAvailable?.includes(c.title))
  }
  // save any unsaved data before reload
  await saveOrUpdateRecords()

  // set value if spinner should be hidden
  showLoading.value = !!shouldShowLoading
  await loadData()
  // reset to default (showing spinner on load)
  showLoading.value = true
}

async function openNewRecordHandler() {
  const newRow = addEmptyRow()
  expandForm(newRow, undefined, true)
}

reloadViewDataHook?.on(reloadViewDataHandler)
openNewRecordFormHook?.on(openNewRecordHandler)

onBeforeUnmount(async () => {
  /** save/update records before unmounting the component */
  const viewMetaValue = view.value
  const dataValue = data.value
  if (viewMetaValue) {
    getMeta(viewMetaValue.fk_model_id, false, true).then((res) => {
      const metaValue = res
      if (!metaValue) return
      saveOrUpdateRecords({
        metaValue,
        viewMetaValue,
        data: dataValue,
      })
    })
  }

  // reset hooks
  reloadViewDataHook?.off(reloadViewDataHandler)
  openNewRecordFormHook?.off(openNewRecordHandler)
})

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!routeQuery.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...routeQuery,
          rowId: undefined,
        },
      })
  },
})

// reload table data reload hook as fallback to rowdatareload
provide(ReloadRowDataHookInj, reloadViewDataHook)

// trigger initial data load in grid
// reloadViewDataHook.trigger()

const switchingTab = ref(false)

watch(
  view,
  async (next, old) => {
    try {
      if (next && next.id !== old?.id) {
        switchingTab.value = true
        // whenever tab changes or view changes save any unsaved data
        if (old?.id) {
          const oldMeta = await getMeta(old.fk_model_id!, false, true)
          if (oldMeta) {
            await saveOrUpdateRecords({
              viewMetaValue: old,
              metaValue: oldMeta as TableType,
              data: data.value,
            })
          }
        }
        await loadData()
      }
    } catch (e) {
      console.log(e)
    } finally {
      switchingTab.value = false
    }
  },
  { immediate: true },
)

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

eventBus.on(async (event, payload) => {
  if (event === SmartsheetStoreEvents.FIELD_ADD) {
    columnOrder.value = payload
    addColumnDropdown.value = true
  }
})

const closeAddColumnDropdown = (scrollToLastCol = false) => {
  columnOrder.value = null
  addColumnDropdown.value = false
  if (scrollToLastCol) {
    setTimeout(() => {
      const lastAddNewRowHeader = tableHeadEl.value?.querySelector('th:last-child')
      if (lastAddNewRowHeader) {
        lastAddNewRowHeader.scrollIntoView({ behavior: 'smooth' })
      }
    }, 200)
  }
}

const confirmDeleteRow = (row: number) => {
  try {
    deleteRow(row)
  } catch (e: any) {
    message.error(e.message)
  }
}

const deleteSelectedRangeOfRows = () => {
  deleteRangeOfRows(selectedRange).then(() => {
    clearSelectedRange()
    activeCell.row = null
    activeCell.col = null
  })
}

function addEmptyRow(row?: number) {
  const rowObj = _addEmptyRow(row)
  nextTick().then(() => {
    clearSelectedRange()
    makeActive(row ?? data.value.length - 1, 0)
    scrollToCell?.()
  })
  return rowObj
}

function openGenerateDialog(target: any) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('SmartsheetDlgGenerate'), {
    'modelValue': isOpen,
    'target': target,
    'meta': meta,
    'view': view,
    'fields': fields,
    'data': data,
    'xWhere': xWhere,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const onDraftRecordClick = () => {
  if (!isLocked?.value) openNewRecordFormHook.trigger()
}
</script>

<template>
  <div
    class="relative flex flex-col h-full min-h-0 w-full"
    data-testid="nc-grid-wrapper"
    style="background-color: var(--nc-grid-bg)"
  >
    <general-overlay :model-value="isLoading" inline transition class="!bg-opacity-15" data-testid="grid-load-spinner">
      <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
        <a-spin size="large" />
      </div>
    </general-overlay>

    <div ref="gridWrapper" class="nc-grid-wrapper min-h-0 flex-1 nc-sidebar-md">
      <a-dropdown
        v-model:visible="contextMenu"
        :trigger="isSqlView ? [] : ['contextmenu']"
        overlay-class-name="nc-dropdown-grid-context-menu"
      >
        <table
          ref="smartTable"
          class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white"
          @contextmenu="showContextMenu"
        >
          <thead ref="tableHeadEl">
            <tr class="nc-grid-header">
              <th class="w-[85px] min-w-[85px]" data-testid="grid-id-column">
                <div class="w-full h-full flex pl-5 pr-1 items-center" data-testid="nc-check-all">
                  <template v-if="!readOnly">
                    <div class="nc-no-label text-gray-400" :class="{ hidden: selectedAllRecords }">#</div>
                    <div
                      :class="{ hidden: !selectedAllRecords, flex: selectedAllRecords }"
                      class="nc-check-all w-full items-center"
                    >
                      <a-checkbox v-model:checked="selectedAllRecords" />

                      <span class="flex-1" />
                    </div>
                  </template>
                  <template v-else>
                    <div class="text-gray-500">#</div>
                  </template>
                </div>
              </th>
              <th
                v-for="col in fields"
                :key="col.title"
                v-xc-ver-resize
                :data-col="col.id"
                :data-title="col.title"
                @xcresize="onresize(col.id, $event)"
                @xcresizing="onXcResizing(col.title, $event)"
                @xcresized="resizingCol = null"
              >
                <div class="w-full h-full flex items-center">
                  <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="readOnly" />

                  <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="readOnly" />
                </div>
              </th>
              <th
                v-if="isAddingColumnAllowed"
                v-e="['c:column:add']"
                class="cursor-pointer"
                @click.stop="addColumnDropdown = true"
              >
                <a-dropdown
                  v-model:visible="addColumnDropdown"
                  :trigger="['click']"
                  overlay-class-name="nc-dropdown-grid-add-column"
                  @visible-change="persistMenu = altModifier"
                >
                  <div class="h-full w-[60px] flex items-center justify-center">
                    <GeneralIcon v-if="altModifier || persistMenu" icon="magic" class="text-sm text-orange-400" />
                    <component :is="iconMap.plus" class="text-sm nc-column-add text-gray-600" />
                  </div>

                  <template v-if="persistMenu" #overlay>
                    <a-menu>
                      <a-sub-menu v-if="predictedNextColumn?.length" key="predict-column">
                        <template #title>
                          <div class="flex flex-row items-center py-3">
                            <MdiTableColumnPlusAfter class="flex h-[1rem] text-gray-500" />
                            <div class="text-xs pl-2">Predict Columns</div>
                            <MdiChevronRight class="text-gray-500 ml-2" />
                          </div>
                        </template>
                        <template #expandIcon></template>
                        <a-menu>
                          <template v-for="col in predictedNextColumn" :key="`predict-${col.title}-${col.type}`">
                            <a-menu-item>
                              <div class="flex flex-row items-center py-3" @click="loadColumn(col.title, col.type)">
                                <div class="text-xs pl-2">{{ col.title }}</div>
                              </div>
                            </a-menu-item>
                          </template>
                          <a-menu-item>
                            <div class="flex flex-row items-center py-3" @click="predictNextColumn">
                              <div class="text-red-500 text-xs pl-2">
                                <MdiReload />
                                Generate Again
                              </div>
                            </div>
                          </a-menu-item>
                        </a-menu>
                      </a-sub-menu>
                      <a-menu-item v-else>
                        <!-- Predict Columns -->
                        <div class="flex flex-row items-center py-3" @click="predictNextColumn">
                          <MdiReload v-if="predictingNextColumn" class="animate-infinite animate-spin" />
                          <MdiTableColumnPlusAfter v-else class="flex h-[1rem] text-gray-500" />
                          <div class="text-xs pl-2">Predict Columns</div>
                        </div>
                      </a-menu-item>
                      <a-sub-menu v-if="predictedNextFormulas" key="predict-formula">
                        <template #title>
                          <div class="flex flex-row items-center py-3">
                            <MdiCalculatorVariant class="flex h-[1rem] text-gray-500" />
                            <div class="text-xs pl-2">Predict Formulas</div>
                            <MdiChevronRight class="text-gray-500 ml-2" />
                          </div>
                        </template>
                        <template #expandIcon></template>
                        <a-menu>
                          <template v-for="col in predictedNextFormulas" :key="`predict-${col.title}-formula`">
                            <a-menu-item>
                              <div
                                class="flex flex-row items-center py-3"
                                @click="loadColumn(col.title, 'Formula', { formula_raw: col.formula })"
                              >
                                <div class="text-xs pl-2">{{ col.title }}</div>
                              </div>
                            </a-menu-item>
                          </template>
                        </a-menu>
                      </a-sub-menu>
                      <a-menu-item v-else>
                        <!-- Predict Formulas -->
                        <div class="flex flex-row items-center py-3" @click="predictNextFormulas">
                          <MdiReload v-if="predictingNextFormulas" class="animate-infinite animate-spin" />
                          <MdiCalculatorVariant v-else class="flex h-[1rem] text-gray-500" />
                          <div class="text-xs pl-2">Predict Formulas</div>
                        </div>
                      </a-menu-item>
                    </a-menu>
                  </template>
                  <template v-else #overlay>
                    <SmartsheetColumnEditOrAddProvider
                      v-if="addColumnDropdown"
                      :preload="preloadColumn"
                      :column-position="columnOrder"
                      @submit="closeAddColumnDropdown(true)"
                      @cancel="closeAddColumnDropdown()"
                      @click.stop
                      @keydown.stop
                      @mounted="preloadColumn = undefined"
                    />
                  </template>
                </a-dropdown>
              </th>
            </tr>
          </thead>
          <tbody ref="tableBodyEl">
            <LazySmartsheetRow v-for="(row, rowIndex) of data" ref="rowRefs" :key="rowIndex" :row="row">
              <template #default="{ state }">
                <tr
                  class="nc-grid-row"
                  :style="{ height: rowHeight ? `${rowHeight * 1.8}rem` : `1.8rem` }"
                  :data-testid="`grid-row-${rowIndex}`"
                >
                  <td
                    key="row-index"
                    class="caption nc-grid-cell pl-5 pr-1"
                    :data-testid="`cell-Id-${rowIndex}`"
                    @contextmenu="contextMenuTarget = null"
                  >
                    <div class="items-center flex gap-1 min-w-[60px]">
                      <div
                        v-if="!readOnly || !isLocked"
                        class="nc-row-no text-xs text-gray-500"
                        :class="{ toggle: !readOnly, hidden: row.rowMeta.selected }"
                      >
                        {{ ((paginationData.page ?? 1) - 1) * (paginationData.pageSize ?? 25) + rowIndex + 1 }}
                      </div>
                      <div
                        v-if="!readOnly"
                        :class="{ hidden: !row.rowMeta.selected, flex: row.rowMeta.selected }"
                        class="nc-row-expand-and-checkbox"
                      >
                        <a-checkbox v-model:checked="row.rowMeta.selected" />
                      </div>
                      <span class="flex-1" />

                      <div
                        v-if="!readOnly || hasRole('commenter', true) || hasRole('viewer', true)"
                        class="nc-expand"
                        :data-testid="`nc-expand-${rowIndex}`"
                        :class="{ 'nc-comment': row.rowMeta?.commentCount }"
                      >
                        <a-spin
                          v-if="row.rowMeta.saving"
                          class="!flex items-center"
                          :data-testid="`row-save-spinner-${rowIndex}`"
                        />
                        <template v-else>
                          <span
                            v-if="row.rowMeta?.commentCount"
                            class="py-1 px-3 rounded-full text-xs cursor-pointer select-none transform hover:(scale-110)"
                            :style="{ backgroundColor: enumColor.light[row.rowMeta.commentCount % enumColor.light.length] }"
                            @click="expandForm(row, state)"
                          >
                            {{ row.rowMeta.commentCount }}
                          </span>
                          <div
                            v-else
                            class="cursor-pointer flex items-center border-1 border-gray-100 active:ring rounded p-1 hover:(bg-gray-50)"
                          >
                            <component
                              :is="iconMap.expand"
                              v-e="['c:row-expand']"
                              class="select-none transform hover:(text-black scale-120) nc-row-expand"
                              @click="expandForm(row, state)"
                            />
                          </div>
                        </template>
                      </div>
                    </div>
                  </td>
                  <SmartsheetTableDataCell
                    v-for="(columnObj, colIndex) of fields"
                    :key="columnObj.id"
                    class="cell relative nc-grid-cell"
                    :class="{
                      'cursor-pointer': hasEditPermission,
                      'active': hasEditPermission && isCellSelected(rowIndex, colIndex),
                      'nc-required-cell': isColumnRequiredAndNull(columnObj, row.row),
                      'align-middle': !rowHeight || rowHeight === 1,
                      'align-top': rowHeight && rowHeight !== 1,
                    }"
                    :data-testid="`cell-${columnObj.title}-${rowIndex}`"
                    :data-key="rowIndex + columnObj.id"
                    :data-col="columnObj.id"
                    :data-title="columnObj.title"
                    @mousedown="handleMouseDown($event, rowIndex, colIndex)"
                    @mouseover="handleMouseOver($event, rowIndex, colIndex)"
                    @click="handleCellClick($event, rowIndex, colIndex)"
                    @dblclick="makeEditable(row, columnObj)"
                    @contextmenu="showContextMenu($event, { row: rowIndex, col: colIndex })"
                  >
                    <div v-if="!switchingTab" class="w-full h-full">
                      <LazySmartsheetVirtualCell
                        v-if="isVirtualCol(columnObj)"
                        v-model="row.row[columnObj.title]"
                        :column="columnObj"
                        :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                        :row="row"
                        :read-only="readOnly"
                        @navigate="onNavigate"
                        @save="updateOrSaveRow(row, '', state)"
                      />

                      <LazySmartsheetCell
                        v-else
                        v-model="row.row[columnObj.title]"
                        :column="columnObj"
                        :edit-enabled="
                          !!hasEditPermission && !!editEnabled && activeCell.col === colIndex && activeCell.row === rowIndex
                        "
                        :row-index="rowIndex"
                        :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                        :read-only="readOnly"
                        @update:edit-enabled="editEnabled = $event"
                        @save="updateOrSaveRow(row, columnObj.title, state)"
                        @navigate="onNavigate"
                        @cancel="editEnabled = false"
                      />
                    </div>
                  </SmartsheetTableDataCell>
                </tr>
              </template>
            </LazySmartsheetRow>

            <tr
              v-if="isAddingEmptyRowAllowed"
              v-e="['c:row:add:grid-bottom']"
              class="text-left pointer nc-grid-add-new-cell cursor-pointer group"
              :class="{
                '!border-r-2 !border-r-gray-100': visibleColLength === 1,
              }"
              @mouseup.stop
              @click="addEmptyRow()"
            >
              <td class="text-left pointer nc-grid-add-new-cell sticky left-0 !border-r-0">
                <div class="px-2 w-full flex items-center text-gray-500">
                  <component :is="iconMap.plus" class="text-pint-500 text-xs ml-2 text-gray-600 group-hover:text-black" />
                </div>
              </td>
              <td class="!border-gray-50" :colspan="visibleColLength"></td>
            </tr>
          </tbody>
        </table>

        <template v-if="!isLocked && hasEditPermission" #overlay>
          <a-menu class="shadow !rounded !py-0" @click="contextMenu = false">
            <a-menu-item
              v-if="contextMenuTarget && (selectedRange.isSingleCell() || selectedRange.isSingleRow())"
              @click="confirmDeleteRow(contextMenuTarget.row)"
            >
              <div v-e="['a:row:delete']" class="nc-project-menu-item">
                <!-- Delete Row -->
                {{ $t('activity.deleteRow') }}
              </div>
            </a-menu-item>

            <a-menu-item v-else-if="contextMenuTarget" @click="deleteSelectedRangeOfRows">
              <div v-e="['a:row:delete']" class="nc-project-menu-item">
                <!-- Delete Rows -->
                Delete Rows
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="appInfo.ee && !contextMenuClosing && !contextMenuTarget && data.some((r) => r.rowMeta.selected)"
              @click="bulkUpdateDlg = true"
            >
              <div v-e="['a:row:update-bulk']" class="nc-project-menu-item">
                <component :is="iconMap.edit" />
                <!-- TODO i18n -->
                Update Selected Rows
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="!contextMenuClosing && !contextMenuTarget && data.some((r) => r.rowMeta.selected)"
              @click="deleteSelectedRows"
            >
              <div v-e="['a:row:delete-bulk']" class="nc-project-menu-item text-red-500">
                <component :is="iconMap.delete" />
                <!-- Delete Selected Rows -->
                {{ $t('activity.deleteSelectedRow') }}
              </div>
            </a-menu-item>

            <!--            Clear cell -->
            <a-menu-item
              v-if="
                contextMenuTarget &&
                selectedRange.isSingleCell() &&
                (fields[contextMenuTarget.col].uidt === UITypes.LinkToAnotherRecord ||
                  !isVirtualCol(fields[contextMenuTarget.col]))
              "
              @click="clearCell(contextMenuTarget)"
            >
              <div v-e="['a:row:clear']" class="nc-project-menu-item">{{ $t('activity.clearCell') }}</div>
            </a-menu-item>

            <!--            Clear cell -->
            <a-menu-item v-else-if="contextMenuTarget" @click="clearSelectedRangeOfCells()">
              <div v-e="['a:row:clear-range']" class="nc-project-menu-item">Clear Cells</div>
            </a-menu-item>

            <a-menu-item v-if="contextMenuTarget && selectedRange.isSingleCell()" @click="addEmptyRow(contextMenuTarget.row + 1)">
              <div v-e="['a:row:insert']" class="nc-project-menu-item">
                <!-- Insert New Row -->
                {{ $t('activity.insertRow') }}
              </div>
            </a-menu-item>

            <a-menu-item v-if="contextMenuTarget" data-testid="context-menu-item-copy" @click="copyValue(contextMenuTarget)">
              <div v-e="['a:row:copy']" class="nc-project-menu-item">
                <!-- Copy -->
                {{ $t('general.copy') }}
              </div>
            </a-menu-item>

            <a-sub-menu v-if="contextMenuTarget" title="NocoAI">
              <a-menu-item @click="openGenerateDialog(contextMenuTarget)">
                <div class="color-transition nc-project-menu-item group">
                  <GeneralIcon icon="magic1" class="group-hover:text-accent" />
                  Generate
                </div>
              </a-menu-item>
            </a-sub-menu>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <LazySmartsheetPagination align-count-on-right>
      <template #add-record>
        <div v-if="isAddingEmptyRowAllowed" class="flex ml-2">
          <a-dropdown-button @click="addEmptyRow()">
            <div class="flex items-center px-2 text-gray-600 hover:text-black">
              <component :is="iconMap.plus" class="text-pint-500 text-xs" />
              <span class="ml-1.5"> New Record </span>
            </div>

            <template #overlay>
              <div
                v-e="['c:row:add:grid-top']"
                :class="{ 'group': !isLocked, 'disabled-ring': isLocked }"
                class="bg-white shadow-sm border-1 border-gray-100 rounded p-2 flex items-center justify-center select-none cursor-pointer hover:bg-gray-50 text-gray-600"
                @click="onDraftRecordClick"
              >
                <MaterialSymbolsEditOutlineRounded class="mr-2" />
                New Record with Form
              </div>
            </template>
            <template #icon>
              <component :is="iconMap.arrowUp" class="text-gray-600 h-3.75" />
            </template>
          </a-dropdown-button>
        </div>
      </template>
    </LazySmartsheetPagination>
    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :row="expandedFormRow"
        :state="expandedFormRowState"
        :meta="meta"
        :view="view"
        @update:model-value="!skipRowRemovalOnCancel && removeRowIfNew(expandedFormRow)"
      />
    </Suspense>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormOnRowIdDlg"
        :key="routeQuery.rowId"
        v-model="expandedFormOnRowIdDlg"
        :row="{ row: {}, oldRow: {}, rowMeta: {} }"
        :meta="meta"
        :row-id="routeQuery.rowId"
        :view="view"
        show-next-prev-icons
        :first-row="getExpandedRowIndex() === 0"
        :last-row="getExpandedRowIndex() === data.length - 1"
        @next="navigateToSiblingRow(NavigateDir.NEXT)"
        @prev="navigateToSiblingRow(NavigateDir.PREV)"
      />
    </Suspense>

    <Suspense>
      <LazyDlgBulkUpdate
        v-if="bulkUpdateDlg"
        v-model="bulkUpdateDlg"
        :meta="meta"
        :view="view"
        :bulk-update-rows="bulkUpdateRows"
        :bulk-update-view="bulkUpdateView"
        :selected-all-records="selectedAllRecords"
        :rows="data.filter((r) => r.rowMeta.selected)"
      />
    </Suspense>
  </div>
</template>

<style lang="scss">
.nc-pagination-wrapper .ant-dropdown-button {
  > .ant-btn {
    @apply !p-0 !rounded-l hover:border-gray-300;
  }

  > .ant-dropdown-trigger {
    @apply !rounded-r;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  @apply !rounded;
}
</style>

<style scoped lang="scss">
.nc-grid-wrapper {
  @apply h-full w-full overflow-auto;

  td,
  th {
    @apply border-gray-50 border-solid border-b border-r bg-gray-50;
    background-color: rgb(252, 252, 252);
    min-height: 41px !important;
    height: 41px !important;
    position: relative;
  }

  td {
    @apply bg-white;
  }

  td:not(:first-child) > div {
    overflow: hidden;
    @apply flex px-1 h-auto;
  }

  table {
    background-color: var(--nc-grid-bg);

    border-collapse: separate;
    border-spacing: 0;
  }

  td {
    text-overflow: ellipsis;
  }

  td.active::after {
    content: '';
    position: absolute;
    z-index: 3;
    height: calc(100% + 2px);
    width: calc(100% + 2px);
    left: -1px;
    top: -1px;
    pointer-events: none;
  }

  // todo: replace with css variable
  td.active::after {
    @apply border-1 border-solid text-primary border-current bg-primary bg-opacity-5;
  }

  //td.active::before {
  //  content: '';
  //  z-index:4;
  //  @apply absolute !w-[10px] !h-[10px] !right-[-5px] !bottom-[-5px] bg-primary;
  //}

  thead th:nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 5;
  }

  tbody td:nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 4;
    background: white;
  }

  thead th:nth-child(2) {
    position: sticky !important;
    left: 85px;
    z-index: 5;
    @apply border-r-1 border-r-gray-75;
  }

  tbody td:nth-child(2) {
    position: sticky !important;
    left: 85px;
    z-index: 4;
    background: white;
    @apply border-r-1 border-r-gray-75;
  }
}

:deep {
  .resizer:hover,
  .resizer:active,
  .resizer:focus {
    // todo: replace with primary color
    @apply bg-blue-500/50;
    cursor: col-resize;
  }
}

.nc-grid-row {
  .nc-row-expand-and-checkbox {
    @apply w-full items-center justify-between;
  }

  .nc-expand {
    &:not(.nc-comment) {
      @apply hidden;
    }

    &.nc-comment {
      display: flex;
    }
  }

  &:hover {
    .nc-row-no.toggle {
      @apply hidden;
    }

    .nc-expand {
      @apply flex;
    }

    .nc-row-expand-and-checkbox {
      @apply flex;
    }
  }
}

.nc-grid-header {
  position: sticky;
  top: -1px;

  @apply z-10 bg-white;

  &:hover {
    .nc-no-label {
      @apply hidden;
    }

    .nc-check-all {
      @apply flex;
    }
  }
}

tbody tr:hover {
  @apply bg-gray-100 bg-opacity-50;
}

.nc-required-cell {
  box-shadow: inset 0 0 2px #f00;
}
</style>
