<script lang="ts" setup>
import { nextTick } from '@vue/runtime-core'
import type { ColumnReqType, ColumnType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes, WorkspaceUserRoles, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  CellUrlDisableOverlayInj,
  FieldsInj,
  IsGroupByInj,
  IsLockedInj,
  MetaInj,
  NavigateDir,
  ReadonlyInj,
  computed,
  enumColor,
  extractPkFromRow,
  iconMap,
  inject,
  isColumnRequiredAndNull,
  isDrawerOrModalExist,
  isEeUI,
  isMac,
  message,
  onClickOutside,
  onMounted,
  provide,
  ref,
  useEventListener,
  useGridViewColumnOrThrow,
  useI18n,
  useMultiSelect,
  useNuxtApp,
  useRoles,
  useRoute,
  useSmartsheetStoreOrThrow,
  useUIPermission,
  useUndoRedo,
  useViewsStore,
  watch,
} from '#imports'
import type { CellRange, Row } from '#imports'

const props = defineProps<{
  data: Row[]
  paginationData?: PaginatedType
  loadData?: () => Promise<void>
  changePage?: (page: number) => void
  callAddEmptyRow?: (addAfter?: number) => Row | undefined
  deleteRow?: (rowIndex: number, undo?: boolean) => Promise<void>
  updateOrSaveRow?: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
  ) => Promise<any>
  selectedAllRecords?: boolean
  deleteRangeOfRows?: (cellRange: CellRange) => Promise<void>
  rowHeight?: number
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
  deleteSelectedRows?: () => Promise<void>
  removeRowIfNew?: (row: Row) => void
  bulkUpdateRows?: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
  ) => Promise<void>
  headerOnly?: boolean
  hideHeader?: boolean
  pagination?: {
    fixedSize?: number
    hideSidebars?: boolean
    extraStyle?: string
  }
  disableSkeleton?: boolean
}>()

const emits = defineEmits(['update:selectedAllRecords', 'bulkUpdateDlg', 'toggleOptimisedQuery'])

const vSelectedAllRecords = useVModel(props, 'selectedAllRecords', emits)

const paginationDataRef = toRef(props, 'paginationData')

const dataRef = toRef(props, 'data')

const paginationStyleRef = toRef(props, 'pagination')

const {
  loadData,
  changePage,
  callAddEmptyRow,
  updateOrSaveRow,
  deleteRow,
  expandForm,
  deleteSelectedRows,
  deleteRangeOfRows,
  removeRowIfNew,
  bulkUpdateRows,
  headerOnly,
  hideHeader,
  disableSkeleton,
} = props

// #Injections
const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const fields = inject(FieldsInj, ref([]))

const readOnly = inject(ReadonlyInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const isPublicView = inject(IsPublicInj, ref(false))

const isGroupBy = inject(IsGroupByInj, ref(false))

const route = useRoute()

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const scrollParent = inject(ScrollParentInj, ref<undefined>())

const { isPkAvail, isSqlView, eventBus } = useSmartsheetStoreOrThrow()

const { isViewDataLoading, isPaginationLoading } = storeToRefs(useViewsStore())

const { $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const { addUndo, clone, defineViewScope } = useUndoRedo()

const {
  predictingNextColumn,
  predictedNextColumn,
  predictingNextFormulas,
  predictedNextFormulas,
  predictNextColumn: _predictNextColumn,
  predictNextFormulas: _predictNextFormulas,
} = useNocoEe().table

const predictNextColumn = async () => {
  await _predictNextColumn(meta)
}

const predictNextFormulas = async () => {
  await _predictNextFormulas(meta)
}

// #Refs

const rowRefs = ref<any[]>()

const smartTable = ref(null)

const gridWrapper = ref<HTMLElement>()

const tableHeadEl = ref<HTMLElement>()

const tableBodyEl = ref<HTMLElement>()

const fillHandle = ref<HTMLElement>()

const cellRefs = ref<{ el: HTMLElement }[]>([])

const gridRect = useElementBounding(gridWrapper)

// #Permissions
const { hasRole } = useRoles()
const { isUIAllowed } = useUIPermission()
const hasEditPermission = computed(() => isUIAllowed('xcDatatableEditable'))
const isAddingColumnAllowed = computed(() => !readOnly.value && !isLocked.value && isUIAllowed('add-column') && !isSqlView.value)

// #Variables
const addColumnDropdown = ref(false)

const altModifier = ref(false)

const persistMenu = ref(false)

const disableUrlOverlay = ref(false)

const preloadColumn = ref<any>()

const scrolling = ref(false)

const isAddNewRecordGridMode = ref(true)

const switchingTab = ref(false)

const showLoading = ref(true)

const isView = false

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const editEnabled = ref(false)

// #Context Menu
const _contextMenu = ref(false)
const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    if (hasEditPermission.value) {
      _contextMenu.value = val
    }
  },
})
const contextMenuClosing = ref(false)
const contextMenuTarget = ref<{ row: number; col: number } | null>(null)

const showContextMenu = (e: MouseEvent, target?: { row: number; col: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

// #Cell - 1

async function clearCell(ctx: { row: number; col: number } | null, skipUpdate = false) {
  if (!ctx || !hasEditPermission.value || (!isLinksOrLTAR(fields.value[ctx.col]) && isVirtualCol(fields.value[ctx.col]))) return

  if (fields.value[ctx.col]?.uidt === UITypes.Links) {
    return message.info('Links column clear is not supported yet')
  }

  const rowObj = dataRef.value[ctx.row]
  const columnObj = fields.value[ctx.col]

  if (isVirtualCol(columnObj)) {
    addUndo({
      undo: {
        fn: async (ctx: { row: number; col: number }, col: ColumnType, row: Row, pg: PaginatedType) => {
          if (paginationDataRef.value?.pageSize === pg.pageSize) {
            if (paginationDataRef.value?.page !== pg.page) {
              await changePage?.(pg.page!)
            }
            const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            const rowObj = dataRef.value[ctx.row]
            const columnObj = fields.value[ctx.col]
            if (
              columnObj.title &&
              rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) &&
              columnObj.id === col.id
            ) {
              rowObj.row[columnObj.title] = row.row[columnObj.title]

              if (rowRefs.value) {
                await rowRefs.value[ctx.row]!.addLTARRef(rowObj.row[columnObj.title], columnObj)
                await rowRefs.value[ctx.row]!.syncLTARRefs(rowObj.row)
              }

              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              activeCell.col = ctx.col
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              activeCell.row = ctx.row
              scrollToCell?.()
            } else {
              throw new Error('Record could not be found')
            }
          } else {
            throw new Error('Page size changed')
          }
        },
        args: [clone(ctx), clone(columnObj), clone(rowObj), clone(paginationDataRef.value)],
      },
      redo: {
        fn: async (ctx: { row: number; col: number }, col: ColumnType, row: Row, pg: PaginatedType) => {
          if (paginationDataRef.value?.pageSize === pg.pageSize) {
            if (paginationDataRef.value?.page !== pg.page) {
              await changePage?.(pg.page!)
            }
            const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            const rowObj = dataRef.value[ctx.row]
            const columnObj = fields.value[ctx.col]
            if (rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) && columnObj.id === col.id) {
              if (rowRefs.value) {
                await rowRefs.value[ctx.row]!.clearLTARCell(columnObj)
              }
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              activeCell.col = ctx.col
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              activeCell.row = ctx.row
              scrollToCell?.()
            } else {
              throw new Error('Record could not be found')
            }
          } else {
            throw new Error('Page size changed')
          }
        },
        args: [clone(ctx), clone(columnObj), clone(rowObj), clone(paginationDataRef.value)],
      },
      scope: defineViewScope({ view: view.value }),
    })
    if (rowRefs.value) await rowRefs.value[ctx.row]!.clearLTARCell(columnObj)
    return
  }

  if (columnObj.title) {
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
  }

  if (!skipUpdate) {
    // update/save cell value
    await updateOrSaveRow?.(rowObj, columnObj.title)
  }
}

function makeEditable(row: Row, col: ColumnType) {
  if (!hasEditPermission.value || editEnabled.value || isView || isLocked.value || readOnly.value || isSystemColumn(col)) {
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

  return (editEnabled.value = true)
}

// #Computed

const isAddingEmptyRowAllowed = computed(
  () => !isView && !isLocked.value && hasEditPermission.value && !isSqlView.value && !isPublicView.value,
)

const visibleColLength = computed(() => fields.value?.length)

const gridWrapperClass = computed<string>(() => {
  const classes = []
  if (headerOnly !== true) {
    if (!scrollParent.value) {
      classes.push('nc-scrollbar-x-md overflow-auto')
    }
  } else {
    classes.push('overflow-visible')
  }

  if (isViewDataLoading.value) {
    classes.push('!overflow-hidden')
  }

  return classes.join(' ')
})

const dummyDataForLoading = computed(() => {
  return Array.from({ length: 40 }).map(() => ({}))
})

const showSkeleton = computed(() => disableSkeleton !== true && (isViewDataLoading.value || isPaginationLoading.value))

// #Grid

function openColumnCreate(data: any) {
  tableHeadEl.value?.querySelector('th:last-child')?.scrollIntoView({ behavior: 'smooth' })
  setTimeout(() => {
    addColumnDropdown.value = true
    preloadColumn.value = data
  }, 500)
}

const closeAddColumnDropdown = (scrollToLastCol = false) => {
  columnOrder.value = null
  addColumnDropdown.value = false
  preloadColumn.value = {}
  if (scrollToLastCol) {
    setTimeout(() => {
      const lastAddNewRowHeader = tableHeadEl.value?.querySelector('th:last-child')
      if (lastAddNewRowHeader) {
        lastAddNewRowHeader.scrollIntoView({ behavior: 'smooth' })
      }
    }, 200)
  }
}

async function openNewRecordHandler() {
  const newRow = addEmptyRow()
  if (newRow) expandForm?.(newRow, undefined, true)
}

const onDraftRecordClick = () => {
  if (!isLocked?.value) {
    openNewRecordFormHook.trigger()
  }
}

const onNewRecordToGridClick = () => {
  isAddNewRecordGridMode.value = true
  addEmptyRow()
}

const onNewRecordToFormClick = () => {
  isAddNewRecordGridMode.value = false
  onDraftRecordClick()
}

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
  isCellInFillRange,
  isFillMode,
} = useMultiSelect(
  meta,
  fields,
  dataRef,
  editEnabled,
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
      if (isCellActive.value && !editEnabled.value && hasEditPermission.value && activeCell.row !== null) {
        e.preventDefault()
        const row = dataRef.value[activeCell.row]
        expandForm?.(row)
        return true
      }
    } else if (e.key === 'Escape') {
      if (editEnabled.value) {
        editEnabled.value = false
        return true
      }
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // add a line break for types like LongText / JSON
        return true
      }
      if (editEnabled.value) {
        editEnabled.value = false
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
          editEnabled.value = false
          return true
        case 'ArrowDown':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = dataRef.value.length - 1
          activeCell.col = activeCell.col ?? 0
          scrollToCell?.()
          editEnabled.value = false
          return true
        case 'ArrowRight':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = fields.value?.length - 1
          scrollToCell?.()
          editEnabled.value = false
          return true
        case 'ArrowLeft':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = 0
          scrollToCell?.()
          editEnabled.value = false
          return true
      }
    }

    if (altOrOptionKey) {
      switch (e.keyCode) {
        case 82: {
          // ALT + R
          if (isAddingEmptyRowAllowed.value) {
            $e('c:shortcut', { key: 'ALT + R' })
            addEmptyRow()
            activeCell.row = dataRef.value.length - 1
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
          if (isAddingColumnAllowed.value) {
            $e('c:shortcut', { key: 'ALT + C' })
            addColumnDropdown.value = true
          }
          break
        }
      }
    }
  },
  async (ctx: { row: number; col?: number; updatedColumnTitle?: string }) => {
    const rowObj = dataRef.value[ctx.row]
    const columnObj = ctx.col !== undefined ? fields.value[ctx.col] : null

    if (!rowObj || !columnObj) {
      return
    }

    if (!ctx.updatedColumnTitle && isVirtualCol(columnObj)) {
      return
    }

    // See DateTimePicker.vue for details
    dataRef.value[ctx.row].rowMeta.isUpdatedFromCopyNPaste = {
      ...dataRef.value[ctx.row].rowMeta.isUpdatedFromCopyNPaste,
      [(ctx.updatedColumnTitle || columnObj.title) as string]: true,
    }

    // update/save cell value
    await updateOrSaveRow?.(rowObj, ctx.updatedColumnTitle || columnObj.title)
  },
  bulkUpdateRows,
  fillHandle,
)

function scrollToRow(row?: number) {
  clearSelectedRange()
  makeActive(row ?? dataRef.value.length - 1, 0)
  selectedRange.startRange({ row: activeCell.row!, col: activeCell.col! })
  scrollToCell?.()
}

function addEmptyRow(row?: number) {
  const rowObj = callAddEmptyRow?.(row)
  nextTick().then(() => {
    scrollToRow(row ?? dataRef.value.length - 1)
  })
  return rowObj
}

const confirmDeleteRow = (row: number) => {
  try {
    deleteRow?.(row)

    if (selectedRange.isRowInRange(row)) {
      clearSelectedRange()
    }

    if (activeCell.row === row) {
      activeCell.row = null
      activeCell.col = null
    }
  } catch (e: any) {
    message.error(e.message)
  }
}

const deleteSelectedRangeOfRows = () => {
  deleteRangeOfRows?.(selectedRange).then(() => {
    clearSelectedRange()
    activeCell.row = null
    activeCell.col = null
  })
}

/** On clicking outside of table reset active cell  */
onClickOutside(tableBodyEl, (e) => {
  // do nothing if mousedown on the scrollbar (scrolling)
  if (scrolling.value) {
    return
  }

  // do nothing if context menu was open
  if (contextMenu.value) return

  if (activeCell.row === null || activeCell.col === null) return

  const activeCol = fields.value[activeCell.col]

  if (editEnabled.value && (isVirtualCol(activeCol) || activeCol.uidt === UITypes.JSON)) return

  // skip if fill mode is active
  if (isFillMode.value) return

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

  editEnabled.value = false
  clearSelectedRange()

  switch (dir) {
    case NavigateDir.NEXT:
      if (activeCell.row < dataRef.value.length - 1) {
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

// #Cell - 2

async function clearSelectedRangeOfCells() {
  if (!hasEditPermission.value) return

  const start = selectedRange.start
  const end = selectedRange.end

  const startRow = Math.min(start.row, end.row)
  const endRow = Math.max(start.row, end.row)
  const startCol = Math.min(start.col, end.col)
  const endCol = Math.max(start.col, end.col)

  const cols = fields.value.slice(startCol, endCol + 1)
  const rows = dataRef.value.slice(startRow, endRow + 1)
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

  await bulkUpdateRows?.(rows, props)
}

const scrollWrapper = computed(() => scrollParent.value || gridWrapper.value)

function scrollToCell(row?: number | null, col?: number | null) {
  row = row ?? activeCell.row
  col = col ?? activeCell.col

  if (row !== null && col !== null) {
    // get active cell
    const rows = tableBodyEl.value?.querySelectorAll('tr')
    const cols = rows?.[row]?.querySelectorAll('td')
    const td = cols?.[col === 0 ? 0 : col + 1]

    if (!td || !scrollWrapper.value) return

    const { height: headerHeight } = tableHeadEl.value!.getBoundingClientRect()
    const tdScroll = getContainerScrollForElement(td, scrollWrapper.value, { top: headerHeight || 40, bottom: 9, right: 9 })

    // if first column set left to 0 since it's sticky it will be visible and calculated value will be wrong
    // setting left to 0 will make it scroll to the left
    if (col === 0) {
      tdScroll.left = 0
    }

    if (rows && row === rows.length - 2) {
      // if last row make 'Add New Row' visible
      const lastRow = rows[rows.length - 1] || rows[rows.length - 2]

      const lastRowScroll = getContainerScrollForElement(lastRow, scrollWrapper.value, {
        top: headerHeight || 40,
        bottom: 9,
        right: 9,
      })

      scrollWrapper.value.scrollTo({
        top: lastRowScroll.top,
        left:
          cols && col === cols.length - 2 // if corner cell
            ? scrollWrapper.value.scrollWidth
            : tdScroll.left,
        behavior: 'smooth',
      })
      return
    }

    if (cols && col === cols.length - 2) {
      // if last column make 'Add New Column' visible
      scrollWrapper.value.scrollTo({
        top: tdScroll.top,
        left: scrollWrapper.value.scrollWidth,
        behavior: 'smooth',
      })
      return
    }

    // scroll into the active cell
    scrollWrapper.value.scrollTo({
      top: tdScroll.top,
      left: tdScroll.left,
      behavior: 'smooth',
    })
  }
}

const saveOrUpdateRecords = async (args: { metaValue?: TableType; viewMetaValue?: ViewType; data?: any } = {}) => {
  let index = -1
  for (const currentRow of args.data || dataRef.value) {
    index++
    /** if new record save row and save the LTAR cells */
    if (currentRow.rowMeta.new) {
      const syncLTARRefs = rowRefs.value?.[index]?.syncLTARRefs
      const savedRow = await updateOrSaveRow?.(currentRow, '', {}, args)
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
          await updateOrSaveRow?.(currentRow, field.title!, {}, args)
        }
      }
    }
  }
}

// #Grid Resize
const { updateGridViewColumn, resizingColWidth, resizingCol } = useGridViewColumnOrThrow()

const onresize = (colID: string | undefined, event: any) => {
  if (!colID) return
  updateGridViewColumn(colID, { width: event.detail })
}

const onXcResizing = (cn: string | undefined, event: any) => {
  if (!cn) return
  resizingCol.value = cn
  resizingColWidth.value = event.detail
}

const loadColumn = (title: string, tp: string, colOptions?: any) => {
  preloadColumn.value = {
    title,
    uidt: tp,
    colOptions,
  }
  persistMenu.value = false
}

// #Fill Handle

const fillHandleTop = ref()
const fillHandleLeft = ref()

const refreshFillHandle = () => {
  nextTick(() => {
    const cellRef = document.querySelector('.last-cell')
    if (cellRef) {
      const cellRect = cellRef.getBoundingClientRect()
      if (!cellRect || !gridWrapper.value) return
      fillHandleTop.value = cellRect.top + cellRect.height - gridRect.top.value + gridWrapper.value.scrollTop
      fillHandleLeft.value = cellRect.left + cellRect.width - gridRect.left.value + gridWrapper.value.scrollLeft
    }
  })
}

const showFillHandle = computed(
  () =>
    !readOnly.value &&
    !isLocked.value &&
    !editEnabled.value &&
    (!selectedRange.isEmpty() || (activeCell.row !== null && activeCell.col !== null)) &&
    !dataRef.value[(isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row) ?? -1]?.rowMeta?.new,
)

watch(
  [() => selectedRange.end.row, () => selectedRange.end.col, () => activeCell.row, () => activeCell.col],
  ([sr, sc, ar, ac], [osr, osc, oar, oac]) => {
    if (sr !== osr || sc !== osc || ar !== oar || ac !== oac) {
      refreshFillHandle()
    }
  },
)

onMounted(() => {
  const resizeObserver = new ResizeObserver(() => {
    refreshFillHandle()
    if (activeCell.row !== null && !dataRef.value?.[activeCell.row]) {
      clearSelectedRange()
      activeCell.row = null
      activeCell.col = null
    }
  })
  if (smartTable.value) resizeObserver.observe(smartTable.value)
})

// #Listeners

eventBus.on(async (event, payload) => {
  if (event === SmartsheetStoreEvents.FIELD_ADD) {
    columnOrder.value = payload
    addColumnDropdown.value = true
  }
  if (event === SmartsheetStoreEvents.CLEAR_NEW_ROW) {
    const removed = removeRowIfNew?.(payload)

    if (removed) {
      clearSelectedRange()
      activeCell.row = null
      activeCell.col = null
    }
  }
})

async function reloadViewDataHandler(shouldShowLoading: boolean | void) {
  if (predictedNextColumn.value?.length) {
    const fieldsAvailable = meta.value?.columns?.map((c) => c.title)
    predictedNextColumn.value = predictedNextColumn.value.filter((c) => !fieldsAvailable?.includes(c.title))
  }
  // save any unsaved data before reload
  await saveOrUpdateRecords()

  // set value if spinner should be hidden
  showLoading.value = !!shouldShowLoading
  await loadData?.()
  // reset to default (showing spinner on load)
  showLoading.value = true
}

useEventListener(scrollWrapper, 'scroll', () => {
  refreshFillHandle()
})

useEventListener(document, 'mousedown', (e) => {
  if (e.offsetX > (e.target as HTMLElement)?.clientWidth || e.offsetY > (e.target as HTMLElement)?.clientHeight) {
    scrolling.value = true
  }
})

useEventListener(document, 'mouseup', () => {
  // wait for click event to finish before setting scrolling to false
  setTimeout(() => {
    scrolling.value = false
  }, 100)
})

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

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 78: {
        // ALT + N
        if (isAddingEmptyRowAllowed.value) {
          addEmptyRow()
        }

        break
      }
    }
  }
})

onBeforeUnmount(async () => {
  /** save/update records before unmounting the component */
  const viewMetaValue = view.value
  const dataValue = dataRef.value
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

reloadViewDataHook?.on(reloadViewDataHandler)
openNewRecordFormHook?.on(openNewRecordHandler)

// #Watchers

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuClosing.value = true
    contextMenuTarget.value = null
  } else {
    contextMenuClosing.value = false
  }
})

watch(
  () => route.params.viewId,
  () => {
    isViewDataLoading.value = true
  },
)

watch(
  view,
  async (next, old) => {
    try {
      if (next && next.id !== old?.id && (next.fk_model_id === route.params.viewId || isPublicView.value)) {
        switchingTab.value = true
        // whenever tab changes or view changes save any unsaved data
        if (old?.id) {
          const oldMeta = await getMeta(old.fk_model_id!, false, true)
          if (oldMeta) {
            await saveOrUpdateRecords({
              viewMetaValue: old,
              metaValue: oldMeta as TableType,
              data: dataRef.value,
            })
          }
        }
        isViewDataLoading.value = true
        try {
          await loadData?.()
        } catch (e) {
          console.log(e)
          message.error('Error loading data')
        } finally {
          isViewDataLoading.value = false
        }
      }
    } catch (e) {
      console.log(e)
    } finally {
      switchingTab.value = false
    }
  },
  { immediate: true },
)

// #Providers

provide(CellUrlDisableOverlayInj, disableUrlOverlay)

// #Expose

defineExpose({
  scrollToRow,
  openColumnCreate,
})

// when expand is clicked the drawer should open
// and cell should loose focs
const expandAndLooseFocus = (row: Row, col: Record<string, any>) => {
  if (expandForm) {
    expandForm(row, col)
  }
  activeCell.row = null
  activeCell.col = null
  selectedRange.clear()
}
</script>

<template>
  <div class="flex flex-col" :class="`${headerOnly !== true ? 'h-full w-full' : ''}`">
    <div ref="gridWrapper" class="nc-grid-wrapper min-h-0 flex-1 relative" :class="gridWrapperClass">
      <a-dropdown
        v-model:visible="contextMenu"
        :trigger="isSqlView ? [] : ['contextmenu']"
        overlay-class-name="nc-dropdown-grid-context-menu"
      >
        <div class="table-overlay" :class="{ 'nc-grid-skelton-loader': showSkeleton }">
          <table
            ref="smartTable"
            class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white"
            @contextmenu="showContextMenu"
          >
            <thead v-show="hideHeader !== true" ref="tableHeadEl">
              <tr v-if="showSkeleton">
                <td
                  v-for="(col, colIndex) of dummyDataForLoading"
                  :key="colIndex"
                  class="!bg-gray-50 h-full"
                  :class="{ 'min-w-50': colIndex !== 0, 'min-w-21.25': colIndex === 0 }"
                >
                  <a-skeleton
                    :active="true"
                    :title="true"
                    :paragraph="false"
                    class="ml-2 -mt-2"
                    :class="{ 'max-w-32': colIndex !== 0, 'max-w-5 !ml-3.5': colIndex === 0 }"
                  />
                </td>
              </tr>
              <tr v-else class="nc-grid-header">
                <th class="w-[85px] min-w-[85px]" data-testid="grid-id-column" @dblclick="() => {}">
                  <div class="w-full h-full flex pl-5 pr-1 items-center" data-testid="nc-check-all">
                    <template v-if="!readOnly">
                      <div class="nc-no-label text-gray-500" :class="{ hidden: vSelectedAllRecords }">#</div>
                      <div
                        :class="{ hidden: !vSelectedAllRecords, flex: vSelectedAllRecords }"
                        class="nc-check-all w-full items-center"
                      >
                        <a-checkbox v-model:checked="vSelectedAllRecords" />

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
                  class="cursor-pointer !border-0 relative"
                  :style="{
                    borderWidth: '0px !important',
                  }"
                  @click.stop="addColumnDropdown = true"
                >
                  <div class="absolute top-0 left-0 h-10.25 border-b-1 border-r-1 border-gray-200 nc-grid-add-edit-column group">
                    <a-dropdown
                      v-model:visible="addColumnDropdown"
                      :trigger="['click']"
                      overlay-class-name="nc-dropdown-grid-add-column"
                      @visible-change="persistMenu = altModifier"
                    >
                      <div class="h-full w-[60px] flex items-center justify-center">
                        <GeneralIcon v-if="isEeUI && (altModifier || persistMenu)" icon="magic" class="text-sm text-orange-400" />
                        <component :is="iconMap.plus" class="text-base nc-column-add text-gray-500 !group-hover:text-black" />
                      </div>

                      <template v-if="isEeUI && persistMenu" #overlay>
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
                  </div>
                </th>
              </tr>
            </thead>
            <tbody v-if="headerOnly !== true" ref="tableBodyEl">
              <template v-if="showSkeleton">
                <tr v-for="(row, rowIndex) of dummyDataForLoading" :key="rowIndex">
                  <td
                    v-for="(col, colIndex) of dummyDataForLoading"
                    :key="colIndex"
                    :class="{ 'min-w-50': colIndex !== 0, 'min-w-21.25': colIndex === 0 }"
                  ></td>
                </tr>
              </template>
              <template v-else>
                <LazySmartsheetRow v-for="(row, rowIndex) of dataRef" ref="rowRefs" :key="rowIndex" :row="row">
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
                            {{ ((paginationDataRef?.page ?? 1) - 1) * (paginationDataRef?.pageSize ?? 25) + rowIndex + 1 }}
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
                            v-if="
                              !readOnly ||
                              hasRole('commenter', true) ||
                              hasRole('viewer', true) ||
                              hasRole(WorkspaceUserRoles.COMMENTER, true) ||
                              hasRole(WorkspaceUserRoles.VIEWER, true)
                            "
                            class="nc-expand"
                            :data-testid="`nc-expand-${rowIndex}`"
                            :class="{ 'nc-comment': row.rowMeta?.commentCount }"
                          >
                            <a-spin
                              v-if="row.rowMeta.saving"
                              class="!flex items-center"
                              :data-testid="`row-save-spinner-${rowIndex}`"
                            />
                            <template v-else-if="!isLocked">
                              <span
                                v-if="row.rowMeta?.commentCount && expandForm"
                                class="py-1 px-3 rounded-full text-xs cursor-pointer select-none transform hover:(scale-110)"
                                :style="{ backgroundColor: enumColor.light[row.rowMeta.commentCount % enumColor.light.length] }"
                                @click="expandAndLooseFocus(row, state)"
                              >
                                {{ row.rowMeta.commentCount }}
                              </span>
                              <div
                                v-else
                                class="cursor-pointer flex items-center border-1 border-gray-100 active:ring rounded p-1 hover:(bg-gray-50)"
                              >
                                <component
                                  :is="iconMap.expand"
                                  v-if="expandForm"
                                  v-e="['c:row-expand']"
                                  class="select-none transform hover:(text-black scale-120) nc-row-expand"
                                  @click="expandAndLooseFocus(row, state)"
                                />
                              </div>
                            </template>
                          </div>
                        </div>
                      </td>
                      <SmartsheetTableDataCell
                        v-for="(columnObj, colIndex) of fields"
                        :key="columnObj.id"
                        ref="cellRefs"
                        class="cell relative nc-grid-cell"
                        :class="{
                          'cursor-pointer': hasEditPermission,
                          'active': hasEditPermission && isCellSelected(rowIndex, colIndex),
                          'active-cell':
                            hasEditPermission &&
                            ((activeCell.row === rowIndex && activeCell.col === colIndex) ||
                              (selectedRange._start?.row === rowIndex && selectedRange._start?.col === colIndex)),
                          'last-cell':
                            rowIndex === (isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row) &&
                            colIndex === (isNaN(selectedRange.end.col) ? activeCell.col : selectedRange.end.col),
                          'nc-required-cell': isColumnRequiredAndNull(columnObj, row.row) && !isPublicView,
                          'align-middle': !rowHeight || rowHeight === 1,
                          'align-top': rowHeight && rowHeight !== 1,
                          'filling': isCellInFillRange(rowIndex, colIndex),
                        }"
                        :data-testid="`cell-${columnObj.title}-${rowIndex}`"
                        :data-key="`data-key-${rowIndex}-${columnObj.id}`"
                        :data-col="columnObj.id"
                        :data-title="columnObj.title"
                        :data-row-index="rowIndex"
                        :data-col-index="colIndex"
                        @mousedown="handleMouseDown($event, rowIndex, colIndex)"
                        @mouseover="handleMouseOver($event, rowIndex, colIndex)"
                        @click="handleCellClick($event, rowIndex, colIndex)"
                        @dblclick="makeEditable(row, columnObj)"
                        @contextmenu="showContextMenu($event, { row: rowIndex, col: colIndex })"
                      >
                        <div v-if="!switchingTab" class="w-full h-full">
                          <LazySmartsheetVirtualCell
                            v-if="isVirtualCol(columnObj) && columnObj.title"
                            v-model="row.row[columnObj.title]"
                            :column="columnObj"
                            :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                            :row="row"
                            :read-only="readOnly"
                            @navigate="onNavigate"
                            @save="updateOrSaveRow?.(row, '', state)"
                          />

                          <LazySmartsheetCell
                            v-else-if="columnObj.title"
                            v-model="row.row[columnObj.title]"
                            :column="columnObj"
                            :edit-enabled="
                              !!hasEditPermission && !!editEnabled && activeCell.col === colIndex && activeCell.row === rowIndex
                            "
                            :row-index="rowIndex"
                            :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                            :read-only="readOnly"
                            @update:edit-enabled="editEnabled = $event"
                            @save="updateOrSaveRow?.(row, columnObj.title, state)"
                            @navigate="onNavigate"
                            @cancel="editEnabled = false"
                          />
                        </div>
                      </SmartsheetTableDataCell>
                    </tr>
                  </template>
                </LazySmartsheetRow>
              </template>

              <tr
                v-if="isAddingEmptyRowAllowed && !isGroupBy"
                v-e="['c:row:add:grid-bottom']"
                class="text-left nc-grid-add-new-cell cursor-pointer group relative z-3"
                :class="{
                  '!border-r-2 !border-r-gray-100': visibleColLength === 1,
                }"
                @mouseup.stop
                @click="addEmptyRow()"
              >
                <td class="text-left pointer sticky left-0 !border-r-0">
                  <div class="px-2 w-full flex items-center text-gray-500">
                    <component :is="iconMap.plus" class="text-pint-500 text-base ml-2 text-gray-600 group-hover:text-black" />
                  </div>
                </td>
                <td class="!border-gray-100" :colspan="visibleColLength"></td>
              </tr>
            </tbody>
          </table>

          <!-- Fill Handle -->
          <div
            v-show="showFillHandle"
            ref="fillHandle"
            class="nc-fill-handle"
            :class="
              (!selectedRange.isEmpty() && selectedRange.end.col !== 0) || (selectedRange.isEmpty() && activeCell.col !== 0)
                ? 'z-3'
                : 'z-4'
            "
            :style="{ top: `${fillHandleTop}px`, left: `${fillHandleLeft}px`, cursor: 'crosshair' }"
          />
        </div>

        <template v-if="!isLocked && hasEditPermission" #overlay>
          <a-menu class="shadow !rounded !py-0" @click="contextMenu = false">
            <a-menu-item
              v-if="isEeUI && !contextMenuClosing && !contextMenuTarget && data.some((r) => r.rowMeta.selected)"
              @click="emits('bulkUpdateDlg')"
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
              <div v-e="['a:row:delete-bulk']" class="nc-project-menu-item">
                <component :is="iconMap.delete" />
                <!-- Delete Selected Rows -->
                {{ $t('activity.deleteSelectedRow') }}
              </div>
            </a-menu-item>

            <a-menu-item v-if="contextMenuTarget && selectedRange.isSingleCell()" @click="addEmptyRow(contextMenuTarget.row + 1)">
              <div v-e="['a:row:insert']" class="nc-project-menu-item">
                <GeneralIcon icon="plus" />
                <!-- Insert New Row -->
                {{ $t('activity.insertRow') }}
              </div>
            </a-menu-item>

            <a-menu-item v-if="contextMenuTarget" data-testid="context-menu-item-copy" @click="copyValue(contextMenuTarget)">
              <div v-e="['a:row:copy']" class="nc-project-menu-item">
                <GeneralIcon icon="copy" />
                <!-- Copy -->
                {{ $t('general.copy') }}
              </div>
            </a-menu-item>

            <!--            Clear cell -->
            <a-menu-item
              v-if="
                contextMenuTarget &&
                selectedRange.isSingleCell() &&
                (isLinksOrLTAR(fields[contextMenuTarget.col]) || !isVirtualCol(fields[contextMenuTarget.col]))
              "
              @click="clearCell(contextMenuTarget)"
            >
              <div v-e="['a:row:clear']" class="nc-project-menu-item">
                <GeneralIcon icon="close" />
                {{ $t('general.clear') }}
              </div>
            </a-menu-item>

            <!--            Clear cell -->
            <a-menu-item v-else-if="contextMenuTarget" @click="clearSelectedRangeOfCells()">
              <div v-e="['a:row:clear-range']" class="nc-project-menu-item">
                <GeneralIcon icon="closeBox" class="text-gray-500" />
                Clear
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="contextMenuTarget && (selectedRange.isSingleCell() || selectedRange.isSingleRow())"
              @click="confirmDeleteRow(contextMenuTarget.row)"
            >
              <div v-e="['a:row:delete']" class="nc-project-menu-item text-red-600">
                <GeneralIcon icon="delete" />
                <!-- Delete Row -->
                {{ $t('activity.deleteRow') }}
              </div>
            </a-menu-item>

            <a-menu-item v-else-if="contextMenuTarget && deleteRangeOfRows" @click="deleteSelectedRangeOfRows">
              <div v-e="['a:row:delete']" class="nc-project-menu-item text-red-600">
                <GeneralIcon icon="delete" class="text-gray-500 text-error" />
                <!-- Delete Rows -->
                Delete rows
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <div v-if="showSkeleton && headerOnly !== true" class="flex flex-row justify-center item-center min-h-10">
      <a-skeleton :active="true" :title="true" :paragraph="false" class="-mt-1 max-w-60" />
    </div>
    <LazySmartsheetPagination
      v-else-if="headerOnly !== true"
      v-model:pagination-data="paginationDataRef"
      align-count-on-right
      :change-page="changePage"
      :hide-sidebars="paginationStyleRef?.hideSidebars === true"
      :fixed-size="paginationStyleRef?.fixedSize"
      :extra-style="paginationStyleRef?.extraStyle"
    >
      <template #add-record>
        <div v-if="isAddingEmptyRowAllowed" class="flex ml-1">
          <a-dropdown-button
            class="nc-grid-add-new-row"
            placement="top"
            @click="isAddNewRecordGridMode ? addEmptyRow() : onNewRecordToFormClick()"
          >
            <div class="flex items-center px-2 text-gray-600 hover:text-black">
              <span>
                <template v-if="isAddNewRecordGridMode"> {{ $t('activity.newRecord') }} </template>
                <template v-else> {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }} </template>
              </span>
            </div>

            <template #overlay>
              <div class="relative overflow-visible min-h-17 w-10">
                <div
                  class="absolute -top-19 flex flex-col h-34.5 w-70 bg-white rounded-lg justify-start overflow-hidden"
                  style="box-shadow: 0px 4px 6px -2px rgba(0, 0, 0, 0.06), 0px -12px 16px -4px rgba(0, 0, 0, 0.1)"
                  :class="{
                    '-left-44': !isAddNewRecordGridMode,
                    '-left-32': isAddNewRecordGridMode,
                  }"
                >
                  <div
                    v-e="['c:row:add:grid-top']"
                    :class="{ 'group': !isLocked, 'disabled-ring': isLocked }"
                    class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer hover:bg-gray-100 text-gray-600 nc-new-record-with-grid"
                    @click="onNewRecordToGridClick"
                  >
                    <div class="flex flex-row items-center justify-between w-full">
                      <div class="flex flex-row items-center justify-start gap-x-3">
                        <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
                        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
                      </div>
                      <div class="h-4 w-4 flex flex-row items-center justify-center">
                        <GeneralIcon v-if="isAddNewRecordGridMode" icon="check" />
                      </div>
                    </div>
                    <div class="flex flex-row text-xs text-gray-400 ml-7.25">{{ $t('labels.addRowGrid') }}</div>
                  </div>
                  <div
                    v-e="['c:row:add:expanded-form']"
                    :class="{ 'group': !isLocked, 'disabled-ring': isLocked }"
                    class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer hover:bg-gray-100 text-gray-600 nc-new-record-with-form"
                    @click="onNewRecordToFormClick"
                  >
                    <div class="flex flex-row items-center justify-between w-full">
                      <div class="flex flex-row items-center justify-start gap-x-2.5">
                        <GeneralIcon class="h-4.5 w-4.5" icon="article" />
                        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }}
                      </div>
                      <div class="h-4 w-4 flex flex-row items-center justify-center">
                        <GeneralIcon v-if="!isAddNewRecordGridMode" icon="check" />
                      </div>
                    </div>
                    <div class="flex flex-row text-xs text-gray-400 ml-7.05">{{ $t('labels.addRowForm') }}</div>
                  </div>
                </div>
              </div>
            </template>
            <template #icon>
              <component :is="iconMap.arrowUp" class="text-gray-600 h-4" />
            </template>
          </a-dropdown-button>
        </div>
      </template>
    </LazySmartsheetPagination>
  </div>
</template>

<style lang="scss">
.nc-pagination-wrapper .ant-dropdown-button {
  > .ant-btn {
    @apply !p-0 !rounded-l-lg hover:border-gray-400;
  }

  > .ant-dropdown-trigger {
    @apply !rounded-r-lg;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  @apply !rounded-lg;
}
</style>

<style scoped lang="scss">
.nc-grid-wrapper {
  @apply h-full w-full;

  .nc-grid-add-edit-column {
    @apply bg-gray-50;
  }
  .nc-grid-add-new-cell:hover td {
    @apply text-black bg-gray-50;
  }

  td,
  th {
    @apply border-gray-100 border-solid border-r bg-gray-50;
    min-height: 41px !important;
    height: 41px !important;
    position: relative;
  }

  th {
    @apply border-b-1 border-gray-200;
  }

  .nc-grid-header th:last-child {
    @apply !border-b-1;
  }

  td {
    @apply bg-white border-b;
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
    @apply text-primary border-current bg-primary bg-opacity-5;
  }

  td.active-cell::after {
    @apply border-1 border-solid text-primary border-current bg-primary bg-opacity-3;
  }

  td.filling::after {
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
  td.filling::after {
    @apply border-1 border-dashed text-primary border-current bg-gray-100 bg-opacity-50;
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
    @apply border-r-1 border-r-gray-200;
  }

  tbody td:nth-child(2) {
    position: sticky !important;
    left: 85px;
    z-index: 4;
    background: white;
    @apply border-r-1 border-r-gray-100;
  }

  .nc-grid-skelton-loader {
    thead th:nth-child(2) {
      @apply border-r-1 !border-r-gray-50;
    }
    tbody td:nth-child(2) {
      @apply border-r-1 !border-r-gray-50;
    }
  }
}

:deep(.resizer:hover),
:deep(.resizer:active),
:deep(.resizer:focus) {
  // todo: replace with primary color
  @apply bg-blue-500/50;
  cursor: col-resize;
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

  @apply z-5 bg-white;

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

.nc-fill-handle {
  @apply w-[6px] h-[6px] absolute rounded-full bg-red-500 !pointer-events-auto mt-[-4px] ml-[-4px];
}

.nc-fill-handle:hover,
.nc-fill-handle:active,
.nc-fill-handle:focus {
  @apply w-[8px] h-[8px] mt-[-5px] ml-[-5px];
}
</style>
