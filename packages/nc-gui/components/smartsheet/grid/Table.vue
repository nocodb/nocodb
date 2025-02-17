<script lang="ts" setup>
import axios from 'axios'
import { nextTick } from '@vue/runtime-core'
import type { ButtonType, ColumnReqType, ColumnType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isAIPromptCol, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { useColumnDrag } from './useColumnDrag'
import { type CellRange, type Group, NavigateDir } from '#imports'

const props = defineProps<{
  data: Row[]
  vGroup?: Group
  paginationData?: PaginatedType
  loadData?: (params?: any, shouldShowLoading?: boolean) => Promise<void>
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
  rowHeightEnum?: number
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean, groupKey?: string) => void
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
  hideCheckbox?: boolean
  pagination?: {
    fixedSize?: number
    hideSidebars?: boolean
    extraStyle?: string
  }
  disableSkeleton?: boolean
  disableVirtualX?: boolean
  disableVirtualY?: boolean
}>()

const emits = defineEmits(['update:selectedAllRecords', 'bulkUpdateDlg', 'toggleOptimisedQuery'])

const vSelectedAllRecords = useVModel(props, 'selectedAllRecords', emits)

const paginationDataRef = toRef(props, 'paginationData')

const dataRef = toRef(props, 'data')

const paginationStyleRef = toRef(props, 'pagination')

const headerOnly = toRef(props, 'headerOnly')

const hideHeader = toRef(props, 'hideHeader')

const disableSkeleton = toRef(props, 'disableSkeleton')

const disableVirtualX = toRef(props, 'disableVirtualX')

const disableVirtualY = toRef(props, 'disableVirtualY')

const { api } = useApi()

const {
  vGroup,
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

const { isMobileMode, isAddNewRecordGridMode, setAddNewRecordGridMode } = useGlobal()

const scrollParent = inject(ScrollParentInj, ref<undefined>())

const { isPkAvail, isSqlView, eventBus } = useSmartsheetStoreOrThrow()

const { isViewDataLoading, isPaginationLoading } = storeToRefs(useViewsStore())

const { $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const { addUndo, clone, defineViewScope } = useUndoRedo()

const {
  isViewColumnsLoading: _isViewColumnsLoading,
  updateGridViewColumn,
  gridViewCols,
  metaColumnById,
  resizingColOldWith,
} = useViewColumnsOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const {
  predictingNextColumn,
  predictedNextColumn,
  predictingNextFormulas,
  predictedNextFormulas,
  predictNextColumn,
  predictNextFormulas,
} = useNocoEe().table

const { paste } = usePaste()

const { addLTARRef, syncLTARRefs, clearLTARCell, cleaMMCell } = useSmartsheetLtarHelpersOrThrow()

const { loadViewAggregate } = useViewAggregateOrThrow()

// #Refs

const smartTable = ref(null)

const gridWrapper = ref<HTMLElement>()

const tableHeadEl = ref<HTMLElement>()

const tableBodyEl = ref<HTMLElement>()

const fillHandle = ref<HTMLElement>()

const { height: tableHeadHeight, width: _tableHeadWidth } = useElementBounding(tableHeadEl)

const isViewColumnsLoading = computed(() => _isViewColumnsLoading.value || !meta.value)

const resizingColumn = ref(false)

const rowHeight = computed(() => (isMobileMode.value ? 56 : rowHeightInPx[`${props.rowHeightEnum}`] ?? 32))

// #Permissions
const { isUIAllowed, isDataReadOnly } = useRoles()
const hasEditPermission = computed(() => isUIAllowed('dataEdit'))
const isAddingColumnAllowed = computed(() => !readOnly.value && !isLocked.value && isUIAllowed('fieldAdd') && !isSqlView.value)

const { onDrag, onDragStart, onDragEnd, draggedCol, dragColPlaceholderDomRef, toBeDroppedColId } = useColumnDrag({
  fields,
  tableBodyEl,
  gridWrapper,
})

const { onLeft, onRight, onUp, onDown } = usePaginationShortcuts({
  paginationDataRef,
  changePage: changePage as any,
  isViewDataLoading,
})

const { generateRows, generatingRows, generatingColumnRows, generatingColumns, aiIntegrations } = useNocoAi()

// #Variables
const addColumnDropdown = ref(false)

const altModifier = ref(false)

const persistMenu = ref(false)

const disableUrlOverlay = ref(false)

const preloadColumn = ref<any>()

const scrolling = ref(false)

const switchingTab = ref(false)

const isView = false

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

const editEnabled = ref(false)

const isGridCellMouseDown = ref(false)

// #Context Menu
const _contextMenu = ref(false)
const contextMenu = computed({
  get: () => {
    if (props.data?.some((r) => r.rowMeta.selected) && isDataReadOnly.value) return false
    return _contextMenu.value
  },
  set: (val) => {
    _contextMenu.value = val
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

const isJsonExpand = ref(false)
provide(JsonExpandInj, isJsonExpand)

const isKeyDown = ref(false)

// #Cell - 1

async function clearCell(ctx: { row: number; col: number } | null, skipUpdate = false) {
  if (
    isDataReadOnly.value ||
    !ctx ||
    !hasEditPermission.value ||
    (!isLinksOrLTAR(fields.value[ctx.col]) && isVirtualCol(fields.value[ctx.col]))
  )
    return

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  if (colMeta.value[ctx.col].isReadonly) return

  const rowObj = dataRef.value[ctx.row]
  const columnObj = fields.value[ctx.col]

  if (isVirtualCol(columnObj)) {
    let mmClearResult

    if (isMm(columnObj) && rowObj) {
      mmClearResult = await cleaMMCell(rowObj, columnObj)
    }

    addUndo({
      undo: {
        fn: async (ctx: { row: number; col: number }, col: ColumnType, row: Row, pg: PaginatedType, mmClearResult: any[]) => {
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
              if (isBt(columnObj) || isOo(columnObj)) {
                rowObj.row[columnObj.title] = row.row[columnObj.title]

                await addLTARRef(rowObj, rowObj.row[columnObj.title], columnObj)
                await syncLTARRefs(rowObj, rowObj.row)
              } else if (isMm(columnObj)) {
                await api.dbDataTableRow.nestedLink(
                  meta.value?.id as string,
                  columnObj.id as string,
                  encodeURIComponent(rowId as string),
                  mmClearResult,
                )
                rowObj.row[columnObj.title] = mmClearResult?.length ? mmClearResult?.length : null
              }

              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              activeCell.col = ctx.col
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              activeCell.row = ctx.row
              scrollToCell?.()
            } else {
              throw new Error(t('msg.recordCouldNotBeFound'))
            }
          } else {
            throw new Error(t('msg.pageSizeChanged'))
          }
        },
        args: [clone(ctx), clone(columnObj), clone(rowObj), clone(paginationDataRef.value), mmClearResult],
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
              if (isBt(columnObj) || isOo(columnObj)) {
                await clearLTARCell(rowObj, columnObj)
              } else if (isMm(columnObj)) {
                await cleaMMCell(rowObj, columnObj)
              }
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              activeCell.col = ctx.col
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              activeCell.row = ctx.row
              scrollToCell?.()
            } else {
              throw new Error(t('msg.recordCouldNotBeFound'))
            }
          } else {
            throw new Error(t('msg.pageSizeChanged'))
          }
        },
        args: [clone(ctx), clone(columnObj), clone(rowObj), clone(paginationDataRef.value)],
      },
      scope: defineViewScope({ view: view.value }),
    })
    if (isBt(columnObj) || isOo(columnObj)) await clearLTARCell(rowObj, columnObj)

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
  if (!hasEditPermission.value || editEnabled.value || isView || readOnly.value || isSystemColumn(col)) {
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

const isAddingEmptyRowAllowed = computed(() => !isView && hasEditPermission.value && !isSqlView.value && !isPublicView.value)

const visibleColLength = computed(() => fields.value?.length)

const gridWrapperClass = computed<string>(() => {
  const classes = []
  if (headerOnly.value !== true) {
    if (!scrollParent.value) {
      classes.push('nc-scrollbar-x-lg !overflow-auto')
    }
  } else {
    classes.push('overflow-visible')
  }

  if (isViewDataLoading.value) {
    classes.push('!overflow-hidden')
  }

  return classes.join(' ')
})

const dummyColumnDataForLoading = computed(() => {
  let length = fields.value?.length ?? 40
  length = length || 40
  return Array.from({ length: length + 1 }).map(() => ({}))
})

const dummyRowDataForLoading = computed(() => {
  return Array.from({ length: 40 }).map(() => ({}))
})

const showSkeleton = computed(
  () =>
    (disableSkeleton.value !== true && (isViewDataLoading.value || isPaginationLoading.value || isViewColumnsLoading.value)) ||
    !meta.value,
)

const cellMeta = computed(() => {
  return dataRef.value.map((row) => {
    return fields.value.map((col) => {
      return {
        isColumnRequiredAndNull: isColumnRequiredAndNull(col, row.row),
      }
    })
  })
})

const colMeta = computed(() => {
  return fields.value.map((col) => {
    return {
      isVirtualCol: isVirtualCol(col),
      isReadonly: isReadonly(col),
    }
  })
})

// #Grid

function openColumnCreate(data: any) {
  scrollToAddNewColumnHeader('smooth')

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
      scrollToAddNewColumnHeader('smooth')
    }, 200)
  }
}

async function openNewRecordHandler(groupKey?: string) {
  if (groupKey && groupKey !== vGroup?.key) return
  // skip update row when it is `New record form`
  const newRow = addEmptyRow(dataRef.value.length, true)
  if (newRow) expandForm?.(newRow, undefined, true, groupKey)
}

const onDraftRecordClick = () => {
  openNewRecordFormHook.trigger(vGroup?.key)
}

const onNewRecordToGridClick = () => {
  setAddNewRecordGridMode(true)
  addEmptyRow()
}

const onNewRecordToFormClick = () => {
  setAddNewRecordGridMode(false)
  onDraftRecordClick()
}

const getContainerScrollForElement = (
  childPos: {
    top: number
    right: number
    bottom: number
    left: number
  },
  container: HTMLElement,
  offset?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  },
) => {
  const parentPos = container.getBoundingClientRect()

  // provide an extra offset to show the prev/next/up/bottom cell
  const extraOffset = 15

  const numColWidth = container.querySelector('thead th:nth-child(1)')?.getBoundingClientRect().width ?? 0
  const primaryColWidth = container.querySelector('thead th:nth-child(2)')?.getBoundingClientRect().width ?? 0

  const stickyColsWidth = numColWidth + primaryColWidth

  const relativePos = {
    right: childPos.right + numColWidth - parentPos.width - container.scrollLeft,
    left: childPos.left + numColWidth - container.scrollLeft - stickyColsWidth,
    bottom: childPos.bottom - parentPos.height - container.scrollTop,
    top: childPos.top - container.scrollTop,
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
  selectRangeMap,
  fillRangeMap,
  activeCell,
  handleMouseDown,
  handleMouseOver,
  handleCellClick: _handleCellClick,
  clearSelectedRange,
  copyValue,
  isCellActive,
  resetSelectedRange,
  makeActive,
  selectedRange,
  isFillMode,
} = useMultiSelect(
  meta,
  fields,
  dataRef,
  undefined,
  editEnabled,
  isPkAvail,
  contextMenu,
  clearCell,
  clearSelectedRangeOfCells,
  makeEditable,
  scrollToCell,
  undefined,
  async (e: KeyboardEvent) => {
    // ignore navigating if single/multi select options is open
    const activeDropdownEl = document.querySelector(
      '.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active',
    )
    if (activeDropdownEl) {
      e.preventDefault()
      return true
    }

    if (isExpandedCellInputExist()) return

    // skip keyboard event handling if there is a drawer / modal
    if (isDrawerOrModalExist() || isLinkDropdownExist()) {
      return true
    }

    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
    const altOrOptionKey = e.altKey
    if (e.key === ' ') {
      const isRichModalOpen = isExpandedCellInputExist()

      if (isCellActive.value && !editEnabled.value && hasEditPermission.value && activeCell.row !== null && !isRichModalOpen) {
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
    } else if (e.key === 'Tab') {
      if (e.shiftKey && activeCell.row === 0 && activeCell.col === 0 && !paginationDataRef.value?.isFirstPage) {
        e.preventDefault()
        await resetAndChangePage((paginationDataRef.value?.pageSize ?? 25) - 1, fields.value?.length - 1, -1)
        return true
      } else if (!e.shiftKey && activeCell.row === dataRef.value.length - 1 && activeCell.col === fields.value?.length - 1) {
        e.preventDefault()

        if (paginationDataRef.value?.isLastPage && isAddingEmptyRowAllowed.value) {
          isKeyDown.value = true

          return true
        } else if (!paginationDataRef.value?.isLastPage) {
          await resetAndChangePage(0, 0, 1)
          return true
        }
      }
    } else if (!cmdOrCtrl && !e.shiftKey && e.key === 'ArrowUp') {
      if (activeCell.row === 0 && !paginationDataRef.value?.isFirstPage) {
        e.preventDefault()
        await resetAndChangePage((paginationDataRef.value?.pageSize ?? 25) - 1, activeCell.col!, -1)
        return true
      }
    } else if (!cmdOrCtrl && !e.shiftKey && e.key === 'ArrowDown') {
      if (activeCell.row === dataRef.value.length - 1) {
        e.preventDefault()

        if (paginationDataRef.value?.isLastPage && isAddingEmptyRowAllowed.value) {
          isKeyDown.value = true

          return true
        } else if (!paginationDataRef.value?.isLastPage) {
          await resetAndChangePage(0, activeCell.col!, 1)
          return true
        }
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
            scrollToAddNewColumnHeader(undefined)

            setTimeout(() => {
              addColumnDropdown.value = true
            }, 250)
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
  undefined,
  fillHandle,
  view,
  paginationDataRef,
  changePage,
)

function scrollToRow(row?: number) {
  clearSelectedRange()
  makeActive(row ?? dataRef.value.length - 1, 0)
  selectedRange.startRange({ row: activeCell.row!, col: activeCell.col! })
  scrollToCell?.()
}

async function saveEmptyRow(rowObj: Row) {
  await updateOrSaveRow?.(rowObj)
}

function addEmptyRow(row?: number, skipUpdate = false) {
  const rowObj = callAddEmptyRow?.(row)

  if (!skipUpdate && rowObj) {
    saveEmptyRow(rowObj)
  }

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

const commentRow = (rowId: number) => {
  try {
    isExpandedFormCommentMode.value = true

    const row = dataRef.value[rowId]
    if (expandForm) {
      expandForm(row)
    }

    activeCell.row = null
    activeCell.col = null
    selectedRange.clear()
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

const isSelectedOnlyAI = computed(() => {
  // selectedRange
  if (selectedRange.start.col === selectedRange.end.col) {
    const field = fields.value[selectedRange.start.col]
    return {
      enabled: isAIPromptCol(field) || isAiButton(field),
      disabled: !(field?.colOptions as ButtonType)?.fk_integration_id,
    }
  }

  return {
    enabled: false,
    disabled: false,
  }
})

const generateAIBulk = async () => {
  if (!isSelectedOnlyAI.value.enabled || !meta?.value?.id || !meta.value.columns) return

  const field = fields.value[selectedRange.start.col]

  if (!field.id) return

  const rows = dataRef.value.slice(selectedRange.start.row, selectedRange.end.row + 1)

  if (!rows || rows.length === 0) return

  let outputColumnIds = [field.id]

  if (isAiButton(field)) {
    outputColumnIds =
      ncIsString(field.colOptions?.output_column_ids) && field.colOptions.output_column_ids.split(',').length > 0
        ? field.colOptions.output_column_ids.split(',')
        : []
  }

  const pks = rows.map((row) => extractPkFromRow(row.row, meta.value!.columns!)).filter((pk) => pk !== null)

  generatingRows.value.push(...pks)
  generatingColumnRows.value.push(field.id)

  generatingColumns.value.push(...outputColumnIds)

  const res = await generateRows(meta.value.id, field.id, pks)

  if (res) {
    // find rows using pk and update with generated rows
    for (const row of res) {
      const oldRow = dataRef.value.find(
        (r) => extractPkFromRow(r.row, meta.value!.columns!) === extractPkFromRow(row, meta.value!.columns!),
      )

      if (oldRow) {
        oldRow.row = { ...oldRow.row, ...row }
      }
    }
  }

  generatingRows.value = generatingRows.value.filter((pk) => !pks.includes(pk))
  generatingColumnRows.value = generatingColumnRows.value.filter((v) => v !== field.id)
  generatingColumns.value = generatingColumns.value.filter((v) => !outputColumnIds?.includes(v))
}

const selectColumn = (columnId: string) => {
  // this is triggered with click event, so do nothing & clear resizingColumn flag if it's true
  if (resizingColumn.value) {
    resizingColumn.value = false
    return
  }
  const colIndex = fields.value.findIndex((col) => col.id === columnId)
  if (colIndex !== -1) {
    makeActive(0, colIndex)
    selectedRange.startRange({ row: 0, col: colIndex })
    selectedRange.endRange({ row: dataRef.value.length - 1, col: colIndex })
  }
}

/** On clicking outside of table reset active cell  */
onClickOutside(tableBodyEl, (e) => {
  // do nothing if mousedown on the scrollbar (scrolling)
  if (scrolling.value) {
    return
  }

  if (resizingColumn.value) {
    return
  }

  // do nothing if context menu was open
  if (contextMenu.value) return

  if (activeCell.row === null || activeCell.col === null) return

  const isRichModalOpen = isExpandedCellInputExist()
  if (isRichModalOpen) return

  const activeCol = fields.value[activeCell.col]

  if (editEnabled.value && (isVirtualCol(activeCol) || activeCol.uidt === UITypes.JSON)) return

  // skip if fill mode is active
  if (isFillMode.value) return

  // ignore unselecting if clicked inside or on the picker(Date, Time, DateTime, Year)
  // or single/multi select options
  const activePickerOrDropdownEl = document.querySelector(
    '.nc-picker-datetime.active,.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active,.nc-dropdown-user-select-cell.active,.nc-picker-date.active,.nc-picker-year.active,.nc-picker-time.active,.nc-link-dropdown-root',
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
  if (!hasEditPermission.value || isDataReadOnly.value) return

  const start = selectedRange.start
  const end = selectedRange.end

  const startRow = Math.min(start.row, end.row)
  const endRow = Math.max(start.row, end.row)
  const startCol = Math.min(start.col, end.col)
  const endCol = Math.max(start.col, end.col)

  const cols = fields.value.slice(startCol, endCol + 1)
  const rows = dataRef.value.slice(startRow, endRow + 1)
  const props = []
  let isInfoShown = false

  for (const row of rows) {
    for (const col of cols) {
      if (!row || !col || !col.title) continue

      // TODO handle LinkToAnotherRecord
      if (isVirtualCol(col)) {
        if ((isBt(col) || isOo(col) || isMm(col)) && !isInfoShown) {
          message.info(t('msg.info.groupClearIsNotSupportedOnLinksColumn'))
          isInfoShown = true
        }
        continue
      }

      // skip readonly columns
      if (isReadonly(col)) continue

      row.row[col.title] = null
      props.push(col.title)
    }
  }

  await bulkUpdateRows?.(rows, props)
}

const colPositions = computed(() => {
  return fields.value
    .filter((col) => col.id && gridViewCols.value[col.id] && gridViewCols.value[col.id].width && gridViewCols.value[col.id].show)
    .map((col) => {
      return +gridViewCols.value[col.id!]!.width!.replace('px', '') || 180
    })
    .reduce(
      (acc, width, i) => {
        acc.push(acc[i] + width)
        return acc
      },
      [0],
    )
})

const scrollWrapper = computed(() => scrollParent.value || gridWrapper.value)

const scrollLeft = ref()

function scrollToCell(row?: number | null, col?: number | null, _scrollBehaviour: ScrollBehavior = 'instant') {
  row = row ?? activeCell.row
  col = col ?? activeCell.col

  if (row !== null && col !== null && scrollWrapper.value) {
    // calculate cell position
    const td = {
      top: row * rowHeight.value,
      left: colPositions.value[col],
      right:
        col === fields.value.length - 1 ? colPositions.value[colPositions.value.length - 1] + 180 : colPositions.value[col + 1],
      bottom: (row + 1) * rowHeight.value,
    }

    const tdScroll = getContainerScrollForElement(td, scrollWrapper.value, {
      top: 9,
      bottom: (tableHeadHeight.value || 40) + 9,
      right: 9,
    })

    if (isGroupBy.value) {
      tdScroll.top = scrollWrapper.value.scrollTop
    }

    // if first column set left to 0 since it's sticky it will be visible and calculated value will be wrong
    // setting left to 0 will make it scroll to the left
    if (col === 0) {
      tdScroll.left = 0
    }

    if (row === dataRef.value.length - 1) {
      requestAnimationFrame(() => {
        scrollWrapper.value.scrollTo({
          top: isGroupBy.value ? scrollWrapper.value.scrollTop : scrollWrapper.value.scrollHeight,
          left:
            col === fields.value.length - 1 // if corner cell
              ? scrollWrapper.value.scrollWidth
              : tdScroll.left,
          behavior: 'instant',
        })
      })
      return
    }

    if (col === fields.value.length - 1) {
      // if last column make 'Add New Column' visible
      requestAnimationFrame(() => {
        scrollWrapper.value.scrollTo({
          top: tdScroll.top,
          left: scrollWrapper.value.scrollWidth,
          behavior: 'instant',
        })
      })
      return
    }

    // scroll into the active cell
    requestAnimationFrame(() => {
      scrollWrapper.value.scrollTo({
        top: tdScroll.top,
        left: tdScroll.left,
        behavior: 'instant',
      })
    })
  }
}

async function resetAndChangePage(row: number, col: number, pageChange?: number) {
  clearSelectedRange()

  if (pageChange !== undefined && paginationDataRef.value?.page) {
    await changePage?.(paginationDataRef.value.page + pageChange)
    await nextTick()
    makeActive(row, col)
  } else {
    makeActive(row, col)
    await nextTick()
  }

  scrollToCell?.()
}

const temporaryNewRowStore = ref<Row[]>([])

const saveOrUpdateRecords = async (
  args: { metaValue?: TableType; viewMetaValue?: ViewType; data?: any; keepNewRecords?: boolean } = {},
) => {
  for (const currentRow of args.data || dataRef.value) {
    if (currentRow.rowMeta.fromExpandedForm) continue

    /** if new record save row and save the LTAR cells */
    if (currentRow.rowMeta.new) {
      const beforeSave = clone(currentRow)
      const savedRow = await updateOrSaveRow?.(currentRow, '', currentRow.rowMeta.ltarState || {}, args)
      if (savedRow) {
        currentRow.rowMeta.changed = false
      } else {
        if (args.keepNewRecords) {
          if (beforeSave.rowMeta.new && Object.keys(beforeSave.row).length) {
            temporaryNewRowStore.value.push(beforeSave)
          }
        }
      }
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

const columnWidthLimit = {
  [UITypes.Attachment]: {
    minWidth: 80,
    maxWidth: Number.POSITIVE_INFINITY,
  },
  [UITypes.Button]: {
    minWidth: 100,
    maxWidth: 320,
  },
}

const normalizedWidth = (col: ColumnType, width: number) => {
  if (col.uidt! in columnWidthLimit) {
    const { minWidth, maxWidth } = columnWidthLimit[col.uidt]

    if (minWidth < width && width < maxWidth) return width
    if (width < minWidth) return minWidth
    if (width > maxWidth) return maxWidth
  }
  return width
}
// #Grid Resize
const onresize = (colID: string | undefined, event: any) => {
  if (!colID || !ncIsString(event?.detail)) return

  const size = event.detail.split('px')[0]

  updateGridViewColumn(colID, { width: `${normalizedWidth(metaColumnById.value[colID], size)}px` })
}

const onXcResizing = (cn: string | undefined, event: any) => {
  if (!cn || !ncIsString(event?.detail)) return

  const size = event.detail.split('px')[0]
  gridViewCols.value[cn].width = `${normalizedWidth(metaColumnById.value[cn], size)}px`

  refreshFillHandle()
}

const onXcStartResizing = (cn: string | undefined, event: any) => {
  if (!cn) return
  resizingColOldWith.value = event.detail
  resizingColumn.value = true
}

const loadColumn = (title: string, tp: string, colOptions?: any) => {
  preloadColumn.value = {
    title,
    uidt: tp,
    ...colOptions,
  }
  persistMenu.value = false
}

const editOrAddProviderRef = ref()

const onVisibilityChange = () => {
  addColumnDropdown.value = true
  if (!editOrAddProviderRef.value?.shouldKeepModalOpen()) {
    addColumnDropdown.value = false
    persistMenu.value = altModifier.value
  }
}

// Virtual scroll

const maxGridWidth = computed(() => {
  // 64 for the row number column
  // count first column twice because it's sticky
  // 100 for add new column
  return colPositions.value[colPositions.value.length - 1] + 64
})

const maxGridHeight = computed(() => {
  // 2 extra rows for the add new row and the sticky header
  return dataRef.value.length * rowHeight.value
})

const colSlice = ref({
  start: 0,
  end: 0,
})

const rowSlice = ref({
  start: 0,
  end: 0,
})

const VIRTUAL_MARGIN = 10

const calculateSlices = () => {
  // if the grid is not rendered yet
  if (!scrollWrapper.value || !gridWrapper.value) {
    colSlice.value = {
      start: 0,
      end: 0,
    }

    rowSlice.value = {
      start: 0,
      end: 0,
    }

    // try again until the grid is rendered
    setTimeout(calculateSlices, 100)
    return
  }

  let renderStart = 0

  if (disableVirtualX.value !== true) {
    // use binary search to find the start and end columns
    let startRange = 0
    let endRange = colPositions.value.length - 1

    while (endRange !== startRange) {
      const middle = Math.floor((endRange - startRange) / 2 + startRange)

      if (
        colPositions.value[middle] <= scrollWrapper.value.scrollLeft &&
        colPositions.value[middle + 1] > scrollWrapper.value.scrollLeft
      ) {
        renderStart = middle
        break
      }

      if (middle === startRange) {
        renderStart = endRange
        break
      } else {
        if (colPositions.value[middle] <= scrollWrapper.value.scrollLeft) {
          startRange = middle
        } else {
          endRange = middle
        }
      }
    }

    let renderEnd = 0
    let renderEndFound = false

    for (let i = renderStart; i < colPositions.value.length; i++) {
      if (colPositions.value[i] > gridWrapper.value.clientWidth + scrollWrapper.value.scrollLeft) {
        renderEnd = i
        renderEndFound = true
        break
      }
    }

    colSlice.value = {
      start: Math.max(0, renderStart - VIRTUAL_MARGIN),
      end: renderEndFound ? Math.min(fields.value.length, renderEnd + VIRTUAL_MARGIN) : fields.value.length,
    }
  }

  if (disableVirtualY.value !== true) {
    const rowRenderStart = Math.max(0, Math.floor(scrollWrapper.value.scrollTop / rowHeight.value) - VIRTUAL_MARGIN)
    const rowRenderEnd = Math.min(
      dataRef.value.length,
      rowRenderStart + Math.ceil(gridWrapper.value.clientHeight / rowHeight.value) + VIRTUAL_MARGIN,
    )

    rowSlice.value = {
      start: rowRenderStart,
      end: rowRenderEnd,
    }
  }
}

const visibleFields = computed(() => {
  if (disableVirtualX.value) return fields.value.map((field, index) => ({ field, index })).filter((f) => f.index !== 0)
  // return data as { field, index } to keep track of the index
  const vFields = fields.value.slice(colSlice.value.start, colSlice.value.end)
  return vFields.map((field, index) => ({ field, index: index + colSlice.value.start })).filter((f) => f.index !== 0)
})

const placeholderStartFields = computed(() => {
  const result = {
    length: 0,
    width: 0,
  }

  if (disableVirtualX.value) return result

  result.length = colSlice.value.start > 0 ? colSlice.value.start - 1 : 0

  result.width = result.length ? colPositions.value[colSlice.value.start]! - colPositions.value[1]! : 0

  return result
})

const placeholderEndFields = computed(() => {
  const result = {
    length: 0,
    width: 0,
  }

  if (disableVirtualX.value) return result

  result.length = colSlice.value.end < fields.value.length - 1 ? fields.value.length - colSlice.value.end : 0

  result.width = result.length ? colPositions.value[fields.value.length]! - colPositions.value[colSlice.value.end]! : 0

  return result
})

const totalRenderedColLength = computed(() => {
  // number col + display col = 2
  return 2 + visibleFields.value.length + placeholderStartFields.value.length + placeholderEndFields.value.length
})

const visibleData = computed(() => {
  if (disableVirtualY.value) return dataRef.value.map((row, index) => ({ row, index }))
  // return data as { row, index } to keep track of the index
  return dataRef.value.slice(rowSlice.value.start, rowSlice.value.end).map((row, index) => ({
    row,
    index: index + rowSlice.value.start,
  }))
})

const totalMaxPlaceholderRows = computed(() => {
  if (!gridWrapper.value || rowSlice.value.start <= 1) {
    return 0
  }

  return parseInt(`${gridWrapper.value?.clientHeight / rowHeight.value}`)
})

const placeholderStartRows = computed(() => {
  const result = {
    length: rowSlice.value.start > 1 ? Math.min(rowSlice.value.start - 1, totalMaxPlaceholderRows.value) : 0,
    rowHeight: rowHeight.value,
    totalRowHeight: 0,
  }

  result.totalRowHeight = result.length * result.rowHeight

  return result
})

const placeholderEndRows = computed(() => {
  const result = {
    length:
      rowSlice.value.end < (paginationDataRef.value?.pageSize ?? 25) - 1
        ? Math.min((paginationDataRef.value?.pageSize ?? 25) - 1 - rowSlice.value.end, totalMaxPlaceholderRows.value)
        : 0,
    rowHeight: rowHeight.value,
    totalRowHeight: 0,
  }

  result.totalRowHeight = result.length * result.rowHeight

  return result
})

const topOffset = computed(() => {
  return rowHeight.value * (rowSlice.value.start - placeholderStartRows.value.length)
})

// #Fill Handle

const fillHandleTop = ref()
const fillHandleLeft = ref()

function refreshFillHandle() {
  nextTick(() => {
    const rowIndex = isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row
    const colIndex = isNaN(selectedRange.end.col) ? activeCell.col : selectedRange.end.col
    if (rowIndex !== null && colIndex !== null) {
      if (!scrollWrapper.value || !gridWrapper.value) return

      // 32 for the header
      fillHandleTop.value = (rowIndex + 1) * rowHeight.value + (hideHeader.value ? 0 : 32)
      // 64 for the row number column
      fillHandleLeft.value =
        64 +
        colPositions.value[colIndex + 1] +
        (colIndex === 0 ? Math.max(0, scrollWrapper.value.scrollLeft - gridWrapper.value.offsetLeft) : 0)
    }
  })
}

const selectedReadonly = computed(
  () =>
    // if all the selected columns are not readonly
    (selectedRange.isEmpty() && activeCell.col && colMeta.value[activeCell.col].isReadonly) ||
    (!selectedRange.isEmpty() &&
      Array.from({ length: selectedRange.end.col - selectedRange.start.col + 1 }).every(
        (_, i) => colMeta.value[selectedRange.start.col + i].isReadonly,
      )),
)

const showFillHandle = computed(
  () =>
    !isDataReadOnly.value &&
    !readOnly.value &&
    !editEnabled.value &&
    (!selectedRange.isEmpty() || (activeCell.row !== null && activeCell.col !== null)) &&
    !dataRef.value[(isNaN(selectedRange.end.row) ? activeCell.row : selectedRange.end.row) ?? -1]?.rowMeta?.new &&
    activeCell.col !== null &&
    fields.value[activeCell.col] &&
    !isViewDataLoading.value &&
    !isPaginationLoading.value &&
    dataRef.value.length &&
    !selectedReadonly.value,
)

watch(
  [() => selectedRange.end.row, () => selectedRange.end.col, () => activeCell.row, () => activeCell.col],
  ([sr, sc, ar, ac], [osr, osc, oar, oac]) => {
    if (sr !== osr || sc !== osc || ar !== oar || ac !== oac) {
      calculateSlices()
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
  until(scrollWrapper)
    .toBeTruthy()
    .then(() => calculateSlices())
})

// #Listeners

eventBus.on(async (event, payload) => {
  if (event === SmartsheetStoreEvents.FIELD_ADD) {
    columnOrder.value = payload
    addColumnDropdown.value = true
  }
  if (event === SmartsheetStoreEvents.CLEAR_NEW_ROW) {
    clearSelectedRange()
    activeCell.row = null
    activeCell.col = null

    removeRowIfNew?.(payload)
  }
})

watch(activeCell, (activeCell) => {
  const row = activeCell.row !== null ? dataRef.value[activeCell.row]?.row : undefined
  const col = row && activeCell.col !== null ? fields.value[activeCell.col] : undefined
  const val = row && col ? row[col.title as string] : undefined

  const rowId = extractPkFromRow(row!, meta.value?.columns as ColumnType[])
  const viewId = view.value?.id

  eventBus.emit(SmartsheetStoreEvents.CELL_SELECTED, { rowId, colId: col?.id, val, viewId })
})

async function reloadViewDataHandler(params: void | { shouldShowLoading?: boolean | undefined; offset?: number | undefined }) {
  if (params?.shouldShowLoading) isViewDataLoading.value = true

  if (predictedNextColumn.value?.length) {
    const fieldsAvailable = meta.value?.columns?.map((c) => c.title)
    predictedNextColumn.value = predictedNextColumn.value.filter((c) => !fieldsAvailable?.includes(c.title))
  }
  // save any unsaved data before reload
  await saveOrUpdateRecords({
    keepNewRecords: true,
  })

  await loadData?.({ ...(params?.offset !== undefined ? { offset: params.offset } : {}) }, params?.shouldShowLoading)

  if (temporaryNewRowStore.value.length) {
    dataRef.value.push(...temporaryNewRowStore.value)
    temporaryNewRowStore.value = []
  }

  calculateSlices()

  isViewDataLoading.value = false
}

let frame: number | null = null

useEventListener(scrollWrapper, 'scroll', (e) => {
  scrollLeft.value = e.target.scrollLeft
  if (frame) {
    cancelAnimationFrame(frame)
  }
  frame = requestAnimationFrame(() => {
    calculateSlices()
    refreshFillHandle()
  })
})

useEventListener(document, 'mousedown', (e) => {
  if (e.offsetX > (e.target as HTMLElement)?.clientWidth || e.offsetY > (e.target as HTMLElement)?.clientHeight) {
    scrolling.value = true
  }

  if ((e.target as HTMLElement).closest('.nc-grid-cell:not(.caption)')) {
    isGridCellMouseDown.value = true
  }
})

useEventListener(document, 'mouseup', () => {
  isGridCellMouseDown.value = false
  // wait for click event to finish before setting scrolling to false
  setTimeout(() => {
    scrolling.value = false
  }, 100)
})

/** handle keypress events */
useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const isRichModalOpen = isExpandedCellInputExist()

  if (e.key === 'Alt' && !isRichModalOpen) {
    altModifier.value = true
  }
})

/** handle keypress events */
useEventListener(document, 'keyup', async (e: KeyboardEvent) => {
  const isRichModalOpen = isExpandedCellInputExist()

  if (e.key === 'Alt' && !isRichModalOpen) {
    altModifier.value = false
    disableUrlOverlay.value = false
  }

  const activeDropdownEl = document.querySelector('.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active')

  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

  if (
    isKeyDown.value &&
    !isRichModalOpen &&
    !activeDropdownEl &&
    !isDrawerOrModalExist() &&
    !cmdOrCtrl &&
    !e.shiftKey &&
    !e.altKey
  ) {
    if (
      (e.key === 'Tab' && activeCell.row === dataRef.value.length - 1 && activeCell.col === fields.value?.length - 1) ||
      (e.key === 'ArrowDown' &&
        activeCell.row === dataRef.value.length - 1 &&
        paginationDataRef.value?.isLastPage &&
        isAddingEmptyRowAllowed.value)
    ) {
      addEmptyRow()
      await resetAndChangePage(dataRef.value.length - 1, 0)
      isKeyDown.value = false
    }
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
          if (isGroupBy.value) {
            await loadData?.()
          } else {
            await Promise.allSettled([loadData?.(), loadViewAggregate()])
          }
          calculateSlices()
        } catch (e) {
          if (!axios.isCancel(e)) {
            console.log(e)
            message.error(t('msg.errorLoadingData'))
          }
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

watch([() => fields.value.length, () => dataRef.value.length], () => {
  calculateSlices()
})

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

const handleCellClick = (event: MouseEvent, row: number, col: number) => {
  const rowData = dataRef.value[row]

  if (isMobileMode.value) {
    return expandAndLooseFocus(rowData, fields.value[col])
  }

  _handleCellClick(event, row, col)
}

const loaderText = computed(() => {
  if (isPaginationLoading.value) {
    if (paginationDataRef.value?.totalRows && paginationDataRef.value?.pageSize) {
      return `Loading page<br/>${paginationDataRef.value.page} of ${Math.ceil(
        paginationDataRef.value?.totalRows / paginationDataRef.value?.pageSize,
      )}`
    } else {
      return t('general.loading')
    }
  }
})

function scrollToAddNewColumnHeader(behavior: ScrollOptions['behavior']) {
  if (scrollWrapper.value) {
    scrollWrapper.value?.scrollTo({
      top: scrollWrapper.value.scrollTop,
      left: scrollWrapper.value.scrollWidth,
      behavior,
    })
  }
}

// Keyboard shortcuts for pagination
onKeyStroke('ArrowLeft', onLeft)
onKeyStroke('ArrowRight', onRight)
onKeyStroke('ArrowUp', onUp)
onKeyStroke('ArrowDown', onDown)
</script>

<template>
  <div class="flex flex-col" :class="`${headerOnly !== true ? 'h-full w-full' : ''}`">
    <div data-testid="drag-icon-placeholder" class="absolute w-1 h-1 pointer-events-none opacity-0"></div>
    <div
      ref="dragColPlaceholderDomRef"
      :class="{
        'hidden w-0 !h-0 left-0 !max-h-0 !max-w-0': !draggedCol,
      }"
      class="absolute flex items-center z-40 top-0 h-full bg-gray-50 pointer-events-none opacity-60"
    >
      <div
        v-if="draggedCol"
        :style="{
        'min-width': gridViewCols[draggedCol.id!]?.width || '180px',
        'max-width': gridViewCols[draggedCol.id!]?.width || '180px',
        'width': gridViewCols[draggedCol.id!]?.width || '180px',
      }"
        class="border-r-1 border-l-1 border-gray-200 h-full"
      ></div>
    </div>
    <div ref="gridWrapper" class="nc-grid-wrapper min-h-0 flex-1 relative" :class="gridWrapperClass">
      <div
        v-show="isPaginationLoading && !headerOnly"
        class="flex items-center justify-center bg-white/80 absolute l-0 t-0 w-full h-full z-10 pb-10 pointer-events-none"
      >
        <div class="flex flex-col items-center justify-center gap-2">
          <GeneralLoader size="xlarge" />
          <span class="text-center" v-html="loaderText"></span>
        </div>
      </div>
      <NcDropdown
        v-model:visible="contextMenu"
        :trigger="isSqlView ? [] : ['contextmenu']"
        overlay-class-name="nc-dropdown-grid-context-menu"
      >
        <div>
          <table
            class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white sticky top-0 z-5 bg-white"
            :class="{
              mobile: isMobileMode,
              desktop: !isMobileMode,
            }"
          >
            <thead v-show="hideHeader !== true" ref="tableHeadEl">
              <tr v-if="isViewColumnsLoading">
                <td
                  v-for="(col, colIndex) of dummyColumnDataForLoading"
                  :key="colIndex"
                  class="!bg-gray-50 h-full border-b-1 border-r-1"
                  :class="{ 'min-w-45': colIndex !== 0, 'min-w-16': colIndex === 0 }"
                >
                  <a-skeleton
                    :active="true"
                    :title="true"
                    :paragraph="false"
                    class="ml-2 -mt-2"
                    :class="{
                      'max-w-32': colIndex !== 0,
                      'max-w-5 !ml-3.5': colIndex === 0,
                    }"
                  />
                </td>
              </tr>
              <tr v-show="!isViewColumnsLoading" class="nc-grid-header">
                <th class="w-[64px] min-w-[64px]" data-testid="grid-id-column">
                  <div class="w-full h-full flex pl-2 pr-1 items-center" data-testid="nc-check-all">
                    <template v-if="!readOnly && !hideCheckbox">
                      <div class="nc-no-label text-gray-500" :class="{ hidden: vSelectedAllRecords }">#</div>
                      <div
                        :class="{
                          hidden: !vSelectedAllRecords,
                          flex: vSelectedAllRecords,
                        }"
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
                  v-if="fields?.[0]?.id"
                  v-xc-ver-resize
                  :data-col="fields[0].id"
                  :data-title="fields[0].title"
                  :style="{
                    'min-width': gridViewCols[fields[0].id]?.width || '180px',
                    'max-width': gridViewCols[fields[0].id]?.width || '180px',
                    'width': gridViewCols[fields[0].id]?.width || '180px',
                  }"
                  class="nc-grid-column-header"
                  :class="{
                    '!border-r-blue-400 !border-r-3': toBeDroppedColId === fields[0].id,
                  }"
                  @xcstartresizing="onXcStartResizing(fields[0].id, $event)"
                  @xcresize="onresize(fields[0].id, $event)"
                  @xcresizing="onXcResizing(fields[0].id, $event)"
                  @click="selectColumn(fields[0].id!)"
                >
                  <div
                    class="w-full h-full flex items-center text-gray-500 pl-2 pr-1"
                    draggable="false"
                    @dragstart.stop="onDragStart(fields[0].id!, $event)"
                    @drag.stop="onDrag($event)"
                    @dragend.stop="onDragEnd($event)"
                  >
                    <LazySmartsheetHeaderVirtualCell
                      v-if="fields[0] && colMeta[0].isVirtualCol"
                      :column="fields[0]"
                      :hide-menu="readOnly || !!isMobileMode"
                    />
                    <LazySmartsheetHeaderCell v-else :column="fields[0]" :hide-menu="readOnly || !!isMobileMode" />
                  </div>
                </th>
                <th
                  v-if="placeholderStartFields.length"
                  :colspan="placeholderStartFields.length"
                  :style="{
                    minWidth: `${placeholderStartFields.width}px`,
                    maxWidth: `${placeholderStartFields.width}px`,
                    width: `${placeholderStartFields.width}px`,
                  }"
                  class="nc-grid-column-header"
                ></th>
                <th
                  v-for="{ field: col, index } in visibleFields"
                  :key="col.id"
                  v-xc-ver-resize
                  :data-col="col.id"
                  :data-title="col.title"
                  :style="{
                    'min-width': gridViewCols[col.id]?.width || '180px',
                    'max-width': gridViewCols[col.id]?.width || '180px',
                    'width': gridViewCols[col.id]?.width || '180px',
                  }"
                  class="nc-grid-column-header"
                  :class="{
                    '!border-r-blue-400 !border-r-3': toBeDroppedColId === col.id,
                  }"
                  @xcstartresizing="onXcStartResizing(col.id, $event)"
                  @xcresize="onresize(col.id, $event)"
                  @xcresizing="onXcResizing(col.id, $event)"
                  @click="selectColumn(col.id!)"
                >
                  <div
                    class="w-full h-full flex items-center text-gray-500 pl-2 pr-1"
                    :draggable="isMobileMode || index === 0 || readOnly || !hasEditPermission ? 'false' : 'true'"
                    @dragstart.stop="onDragStart(col.id!, $event)"
                    @drag.stop="onDrag($event)"
                    @dragend.stop="onDragEnd($event)"
                  >
                    <LazySmartsheetHeaderVirtualCell
                      v-if="colMeta[index].isVirtualCol"
                      :column="col"
                      :hide-menu="readOnly || !!isMobileMode"
                    />
                    <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="readOnly || !!isMobileMode" />
                  </div>
                </th>
                <th
                  v-if="placeholderEndFields.length"
                  :colspan="placeholderEndFields.length"
                  :style="{
                    minWidth: `${placeholderEndFields.width}px`,
                    maxWidth: `${placeholderEndFields.width}px`,
                    width: `${placeholderEndFields.width}px`,
                  }"
                  class="nc-grid-column-header"
                ></th>
                <th
                  v-if="isAddingColumnAllowed"
                  v-e="['c:column:add']"
                  class="cursor-pointer !border-0 relative !xs:hidden"
                  :style="{
                    borderWidth: '0px !important',
                  }"
                  @click.stop="addColumnDropdown = true"
                >
                  <div class="absolute top-0 left-0 h-8 border-b-1 border-r-1 border-gray-200 nc-grid-add-edit-column group">
                    <a-dropdown
                      v-model:visible="addColumnDropdown"
                      :trigger="['click']"
                      overlay-class-name="nc-dropdown-add-column"
                      @visible-change="onVisibilityChange"
                    >
                      <div class="h-full w-[60px] flex items-center justify-center">
                        <GeneralIcon v-if="isEeUI && (altModifier || persistMenu)" icon="magic" class="text-sm text-orange-400" />
                        <component :is="iconMap.plus" class="text-base nc-column-add text-gray-500 !group-hover:text-black" />
                      </div>

                      <template v-if="isEeUI && persistMenu && meta?.id" #overlay>
                        <NcMenu class="predict-menu" variant="small">
                          <NcSubMenu v-if="predictedNextColumn?.length" key="predict-column" class="py-0 px-0 w-full">
                            <template #title>
                              <div class="flex flex-row items-center px-1 py-0.5 gap-1 w-full">
                                <MdiTableColumnPlusAfter class="flex h-[1rem] text-gray-500" />
                                <div class="text-xs flex-1">
                                  {{ $t('activity.predictColumns') }}
                                </div>
                                <MdiChevronRight class="text-gray-500" />
                              </div>
                            </template>
                            <template #expandIcon></template>
                            <template v-for="col in predictedNextColumn" :key="`predict-${col.title}-${col.type}`">
                              <NcMenuItem class="w-full flex items-center" @click="loadColumn(col.title, col.type)">
                                <div class="text-xs">{{ col.title }}</div>
                              </NcMenuItem>
                            </template>

                            <NcMenuItem class="flex flex-row items-center" @click="predictNextColumn(meta.id)">
                              <div class="text-red-500 text-xs">
                                <MdiReload />
                                Generate Again
                              </div>
                            </NcMenuItem>
                          </NcSubMenu>
                          <NcMenuItem v-else class="flex flex-row items-center py-3" @click="predictNextColumn(meta.id)">
                            <!-- Predict Columns -->
                            <MdiReload v-if="predictingNextColumn" class="animate-infinite animate-spin" />
                            <MdiTableColumnPlusAfter v-else class="flex h-[1rem] text-gray-500" />
                            <div class="text-xs">
                              {{ $t('activity.predictColumns') }}
                            </div>
                          </NcMenuItem>
                          <NcSubMenu v-if="predictedNextFormulas?.length" key="predict-formula" class="py-0 px-0 w-full">
                            <template #title>
                              <div class="flex flex-row items-center px-1 py-0.5 gap-1 w-full">
                                <MdiCalculatorVariant class="flex h-[1rem] text-gray-500" />
                                <div class="text-xs flex-1">
                                  {{ $t('activity.predictFormulas') }}
                                </div>
                                <MdiChevronRight class="text-gray-500" />
                              </div>
                            </template>
                            <template #expandIcon></template>
                            <template v-for="col in predictedNextFormulas" :key="`predict-${col.title}-formula`">
                              <NcMenuItem
                                class="flex flex-row items-center"
                                @click="
                                  loadColumn(col.title, 'Formula', {
                                    formula_raw: col.formula,
                                  })
                                "
                              >
                                <div class="text-xs">{{ col.title }}</div>
                              </NcMenuItem>
                            </template>

                            <NcMenuItem class="flex flex-row items-center" @click="predictNextFormulas(meta.id)">
                              <div class="text-red-500 text-xs">
                                <MdiReload />
                                Generate Again
                              </div>
                            </NcMenuItem>
                          </NcSubMenu>
                          <NcMenuItem v-else class="flex flex-row items-center py-3" @click="predictNextFormulas(meta.id)">
                            <!-- Predict Formulas -->
                            <MdiReload v-if="predictingNextFormulas" class="animate-infinite animate-spin" />
                            <MdiCalculatorVariant v-else class="flex h-[1rem] text-gray-500" />
                            <div class="text-xs">
                              {{ $t('activity.predictFormulas') }}
                            </div>
                          </NcMenuItem>
                        </NcMenu>
                      </template>
                      <template v-else #overlay>
                        <div class="nc-edit-or-add-provider-wrapper">
                          <LazySmartsheetColumnEditOrAddProvider
                            v-if="addColumnDropdown"
                            ref="editOrAddProviderRef"
                            :preload="preloadColumn"
                            :column-position="columnOrder"
                            :class="{ hidden: isJsonExpand }"
                            @submit="closeAddColumnDropdown(true)"
                            @cancel="closeAddColumnDropdown()"
                            @click.stop
                            @keydown.stop
                            @mounted="preloadColumn = undefined"
                          />
                        </div>
                      </template>
                    </a-dropdown>
                  </div>
                </th>
                <th
                  class="!border-0 relative !xs:hidden"
                  :style="{
                    borderWidth: '0px !important',
                  }"
                >
                  <div
                    class="absolute top-0 w-45"
                    :class="{
                      'left-[60px]': isAddingColumnAllowed,
                      'left-0': !isAddingColumnAllowed,
                    }"
                  >
                    &nbsp;
                  </div>
                </th>
              </tr>
            </thead>
          </table>
          <div
            v-if="!showSkeleton"
            class="table-overlay"
            :class="{ 'nc-grid-skeleton-loader': showSkeleton }"
            :style="{
              height: `${maxGridHeight}px`,
              width: `${maxGridWidth}px`,
            }"
          >
            <table
              ref="smartTable"
              class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white relative"
              :class="{
                'mobile': isMobileMode,
                'desktop': !isMobileMode,
                'w-full': dataRef.length === 0,
                'pb-12': !headerOnly && !isGroupBy,
              }"
              :style="{
                transform: `translateY(${topOffset}px)`,
              }"
              @contextmenu="showContextMenu"
            >
              <tbody v-if="headerOnly !== true" ref="tableBodyEl">
                <template v-if="showSkeleton">
                  <tr v-for="(row, rowIndex) of dummyRowDataForLoading" :key="rowIndex">
                    <td
                      v-for="(col, colIndex) of dummyColumnDataForLoading"
                      :key="colIndex"
                      class="border-b-1 border-r-1"
                      :class="{ 'min-w-45': colIndex !== 0, 'min-w-16': colIndex === 0 }"
                    ></td>
                  </tr>
                </template>
                <template v-if="!showSkeleton && placeholderStartRows.length">
                  <LazySmartsheetGridPlaceholderRow
                    :row-count="placeholderStartRows.length"
                    :row-height="placeholderStartRows.rowHeight"
                    :total-row-height="placeholderStartRows.totalRowHeight"
                    :col-count="totalRenderedColLength"
                  />
                </template>
                <LazySmartsheetRow v-for="{ row, index: rowIndex } in visibleData" :key="rowIndex" :row="row">
                  <template #default="{ state }">
                    <tr
                      v-show="!showSkeleton"
                      class="nc-grid-row !xs:h-14"
                      :class="{
                        'active-row': activeCell.row === rowIndex || selectedRange._start?.row === rowIndex,
                        'mouse-down': isGridCellMouseDown || isFillMode,
                        'selected-row': row.rowMeta.selected,
                      }"
                      :style="{ height: rowHeight ? `${rowHeight}px` : `${rowHeightInPx['1']}px` }"
                      :data-testid="`grid-row-${rowIndex}`"
                    >
                      <td
                        key="row-index"
                        class="caption nc-grid-cell w-[64px] min-w-[64px]"
                        :data-testid="`cell-Id-${rowIndex}`"
                        @contextmenu="contextMenuTarget = null"
                      >
                        <div class="w-[60px] pl-2 pr-1 items-center flex gap-1">
                          <div
                            class="nc-row-no sm:min-w-4 text-xs text-gray-500"
                            :class="{ toggle: !readOnly, hidden: row.rowMeta.selected }"
                          >
                            {{ ((paginationDataRef?.page ?? 1) - 1) * (paginationDataRef?.pageSize ?? 25) + rowIndex + 1 }}
                          </div>
                          <div
                            v-if="!readOnly"
                            :class="{
                              hidden: !row.rowMeta.selected,
                              flex: row.rowMeta.selected,
                            }"
                            class="nc-row-expand-and-checkbox"
                          >
                            <a-checkbox v-model:checked="row.rowMeta.selected" />
                          </div>
                          <span class="flex-1" />

                          <div
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
                                v-if="row.rowMeta?.commentCount && expandForm"
                                v-e="['c:expanded-form:open']"
                                class="px-1 rounded-md rounded-bl-none transition-all border-1 border-brand-200 text-xs cursor-pointer font-sembold select-none leading-5 text-brand-500 bg-brand-50"
                                @click="expandAndLooseFocus(row, state)"
                              >
                                {{ row.rowMeta.commentCount }}
                              </span>
                              <div
                                v-else
                                class="cursor-pointer flex items-center border-1 border-gray-100 active:ring rounded-md p-1 hover:(bg-white border-nc-border-gray-medium)"
                              >
                                <component
                                  :is="iconMap.maximize"
                                  v-if="expandForm"
                                  v-e="['c:row-expand:open']"
                                  class="select-none nc-row-expand opacity-90 w-4 h-4"
                                  @click="expandAndLooseFocus(row, state)"
                                />
                              </div>
                            </template>
                          </div>
                        </div>
                      </td>
                      <SmartsheetTableDataCell
                        v-if="fields[0]"
                        :key="fields[0].id"
                        class="cell relative nc-grid-cell cursor-pointer"
                        :class="{
                          'active': selectRangeMap[`${rowIndex}-0`],
                          'active-cell':
                            (activeCell.row === rowIndex && activeCell.col === 0) ||
                            (selectedRange._start?.row === rowIndex && selectedRange._start?.col === 0),
                          'nc-required-cell': cellMeta[rowIndex][0].isColumnRequiredAndNull && !isPublicView,
                          'align-middle': !rowHeightEnum || rowHeightEnum === 1,
                          'align-top': rowHeightEnum && rowHeightEnum !== 1,
                          'filling': fillRangeMap[`${rowIndex}-0`],
                          'readonly': colMeta[0].isReadonly && hasEditPermission && selectRangeMap[`${rowIndex}-0`],
                          '!border-r-blue-400 !border-r-3': toBeDroppedColId === fields[0].id,
                        }"
                        :style="{
                          'min-width': gridViewCols[fields[0].id]?.width || '180px',
                          'max-width': gridViewCols[fields[0].id]?.width || '180px',
                          'width': gridViewCols[fields[0].id]?.width || '180px',
                        }"
                        :data-testid="`cell-${fields[0].title}-${rowIndex}`"
                        :data-key="`data-key-${rowIndex}-${fields[0].id}`"
                        :data-col="fields[0].id"
                        :data-title="fields[0].title"
                        :data-row-index="rowIndex"
                        :data-col-index="0"
                        @mousedown="handleMouseDown($event, rowIndex, 0)"
                        @mouseover="handleMouseOver($event, rowIndex, 0)"
                        @click="handleCellClick($event, rowIndex, 0)"
                        @dblclick="makeEditable(row, fields[0])"
                        @contextmenu="showContextMenu($event, { row: rowIndex, col: 0 })"
                      >
                        <div v-if="!switchingTab" class="w-full">
                          <LazySmartsheetVirtualCell
                            v-if="fields[0] && colMeta[0].isVirtualCol && fields[0].title"
                            v-model="row.row[fields[0].title]"
                            :column="fields[0]"
                            :active="activeCell.col === 0 && activeCell.row === rowIndex"
                            :row="row"
                            :read-only="!hasEditPermission"
                            @navigate="onNavigate"
                            @save="updateOrSaveRow?.(row, '', state)"
                          />

                          <LazySmartsheetCell
                            v-else-if="fields[0] && fields[0].title"
                            v-model="row.row[fields[0].title]"
                            :column="fields[0]"
                            :edit-enabled="
                              !!hasEditPermission && !!editEnabled && activeCell.col === 0 && activeCell.row === rowIndex
                            "
                            :row-index="rowIndex"
                            :active="activeCell.col === 0 && activeCell.row === rowIndex"
                            :read-only="!hasEditPermission"
                            @update:edit-enabled="editEnabled = $event"
                            @save="updateOrSaveRow?.(row, fields[0].title, state)"
                            @navigate="onNavigate"
                            @cancel="editEnabled = false"
                          />
                        </div>
                      </SmartsheetTableDataCell>
                      <td
                        v-if="placeholderStartFields.length"
                        :colspan="placeholderStartFields.length"
                        :style="{
                          minWidth: `${placeholderStartFields.width}px`,
                          maxWidth: `${placeholderStartFields.width}px`,
                          width: `${placeholderStartFields.width}px`,
                        }"
                        class="nc-grid-cell"
                      ></td>
                      <SmartsheetTableDataCell
                        v-for="{ field: columnObj, index: colIndex } of visibleFields"
                        :key="`cell-${colIndex}-${rowIndex}`"
                        class="cell relative nc-grid-cell cursor-pointer"
                        :class="{
                          'active': selectRangeMap[`${rowIndex}-${colIndex}`],
                          'active-cell':
                            (activeCell.row === rowIndex && activeCell.col === colIndex) ||
                            (selectedRange._start?.row === rowIndex && selectedRange._start?.col === colIndex),
                          'nc-required-cell': cellMeta[rowIndex][colIndex].isColumnRequiredAndNull && !isPublicView,
                          'align-middle': !rowHeightEnum || rowHeightEnum === 1,
                          'align-top': rowHeightEnum && rowHeightEnum !== 1,
                          'filling': fillRangeMap[`${rowIndex}-${colIndex}`],
                          'readonly':
                            colMeta[colIndex].isReadonly && hasEditPermission && selectRangeMap[`${rowIndex}-${colIndex}`],
                          '!border-r-blue-400 !border-r-3': toBeDroppedColId === columnObj.id,
                        }"
                        :style="{
                          'min-width': gridViewCols[columnObj.id]?.width || '180px',
                          'max-width': gridViewCols[columnObj.id]?.width || '180px',
                          'width': gridViewCols[columnObj.id]?.width || '180px',
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
                        <div v-if="!switchingTab" class="w-full">
                          <LazySmartsheetVirtualCell
                            v-if="colMeta[colIndex].isVirtualCol && columnObj.title"
                            v-model="row.row[columnObj.title]"
                            :column="columnObj"
                            :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                            :row="row"
                            :read-only="!hasEditPermission"
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
                            :read-only="!hasEditPermission"
                            @update:edit-enabled="editEnabled = $event"
                            @save="updateOrSaveRow?.(row, columnObj.title, state)"
                            @navigate="onNavigate"
                            @cancel="editEnabled = false"
                          />
                        </div>
                      </SmartsheetTableDataCell>
                      <td
                        v-if="placeholderEndFields.length"
                        :colspan="placeholderEndFields.length"
                        :style="{
                          minWidth: `${placeholderEndFields.width}px`,
                          maxWidth: `${placeholderEndFields.width}px`,
                          width: `${placeholderEndFields.width}px`,
                        }"
                        class="nc-grid-cell"
                      ></td>
                    </tr>
                  </template>
                </LazySmartsheetRow>

                <template v-if="!showSkeleton && placeholderEndRows.length">
                  <LazySmartsheetGridPlaceholderRow
                    :row-count="placeholderEndRows.length"
                    :row-height="placeholderEndRows.rowHeight"
                    :total-row-height="placeholderEndRows.totalRowHeight"
                    :col-count="totalRenderedColLength"
                  />
                </template>

                <tr
                  v-if="isAddingEmptyRowAllowed && !isGroupBy"
                  v-e="['c:row:add:grid-bottom']"
                  class="text-left nc-grid-add-new-cell cursor-pointer group relative z-3 xs:hidden"
                  :class="{
                    '!border-r-2 !border-r-gray-100': visibleColLength === 1,
                  }"
                  @mouseup.stop
                  @click="addEmptyRow()"
                >
                  <td
                    class="nc-grid-add-new-cell-item h-8 border-b-1 border-gray-100 bg-white group-hover:bg-gray-50 absolute left-0 bottom-0 px-2 sticky z-40 w-full flex items-center text-gray-500"
                  >
                    <component
                      :is="iconMap.plus"
                      v-if="!isViewColumnsLoading"
                      class="text-pint-500 text-base ml-2 mt-0 text-gray-600 group-hover:text-black"
                    />
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
              :style="{
                top: `${fillHandleTop}px`,
                left: `${fillHandleLeft}px`,
                cursor: 'crosshair',
              }"
            />
          </div>
        </div>

        <template #overlay>
          <NcMenu class="!rounded !py-0" variant="small" @click="contextMenu = false">
            <NcMenuItem
              v-if="
                isEeUI && !contextMenuClosing && !contextMenuTarget && data.some((r) => r.rowMeta.selected) && !isDataReadOnly
              "
              @click="emits('bulkUpdateDlg')"
            >
              <div v-e="['a:row:update-bulk']" class="flex gap-2 items-center">
                <component :is="iconMap.ncEdit" />
                {{ $t('title.updateSelectedRows') }}
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="!contextMenuClosing && !contextMenuTarget && data.some((r) => r.rowMeta.selected) && !isDataReadOnly"
              class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
              data-testid="nc-delete-row"
              @click="deleteSelectedRows"
            >
              <div
                v-if="data.filter((r) => r.rowMeta.selected).length === 1"
                v-e="['a:row:delete']"
                class="flex gap-2 items-center"
              >
                <component :is="iconMap.delete" />
                <!-- Delete Selected Rows -->
                {{ $t('activity.deleteSelectedRow') }}
              </div>
              <div v-else v-e="['a:row:delete-bulk']" class="flex gap-2 items-center">
                <component :is="iconMap.delete" />
                <!-- Delete Selected Rows -->
                {{ $t('activity.deleteSelectedRow') }}
              </div>
            </NcMenuItem>

            <!--            <NcMenuItem -->
            <!--              v-if="contextMenuTarget && selectedRange.isSingleCell()" -->
            <!--              class="nc-base-menu-item" -->
            <!--              @click="addEmptyRow(contextMenuTarget.row + 1)" -->
            <!--            > -->
            <!--              <div v-e="['a:row:insert']" class="flex gap-2 items-center"> -->
            <!--                <GeneralIcon icon="plus" /> -->
            <!--                Insert New Row -->
            <!--                {{ $t('activity.insertRow') }} -->
            <!--              </div> -->
            <!--            </NcMenuItem> -->

            <NcTooltip
              v-if="contextMenuTarget && hasEditPermission && !isDataReadOnly && isSelectedOnlyAI.enabled"
              :disabled="!isSelectedOnlyAI.disabled"
            >
              <template #title>
                {{
                  aiIntegrations.length ? $t('tooltip.aiIntegrationReConfigure') : $t('tooltip.aiIntegrationAddAndReConfigure')
                }}
              </template>
              <NcMenuItem
                class="nc-base-menu-item"
                data-testid="context-menu-item-bulk"
                :disabled="isSelectedOnlyAI.disabled"
                @click="generateAIBulk"
              >
                <div class="flex gap-2 items-center">
                  <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
                  <!-- Generate All -->
                  Generate {{ selectedRange.isSingleCell() ? 'Cell' : 'All' }}
                </div>
              </NcMenuItem>
            </NcTooltip>

            <NcMenuItem
              v-if="contextMenuTarget"
              class="nc-base-menu-item"
              data-testid="context-menu-item-copy"
              @click="copyValue(contextMenuTarget)"
            >
              <div v-e="['a:row:copy']" class="flex gap-2 items-center">
                <GeneralIcon icon="copy" />
                <!-- Copy -->
                {{ $t('general.copy') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="contextMenuTarget && hasEditPermission && !isDataReadOnly"
              class="nc-base-menu-item"
              data-testid="context-menu-item-paste"
              :disabled="selectedReadonly"
              @click="paste"
            >
              <div v-e="['a:row:paste']" class="flex gap-2 items-center">
                <GeneralIcon icon="paste" />
                <!-- Paste -->
                {{ $t('general.paste') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>

            <!-- Clear cell -->
            <NcMenuItem
              v-if="
                contextMenuTarget &&
                hasEditPermission &&
                selectedRange.isSingleCell() &&
                (isLinksOrLTAR(fields[contextMenuTarget.col]) || !cellMeta[0]?.[contextMenuTarget.col].isVirtualCol) &&
                !isDataReadOnly
              "
              class="nc-base-menu-item"
              :disabled="selectedReadonly"
              data-testid="context-menu-item-clear"
              @click="clearCell(contextMenuTarget)"
            >
              <div v-e="['a:row:clear']" class="flex gap-2 items-center">
                <GeneralIcon icon="close" />
                {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>

            <!-- Clear cell -->
            <NcMenuItem
              v-else-if="contextMenuTarget && hasEditPermission && !isDataReadOnly"
              class="nc-base-menu-item"
              :disabled="selectedReadonly"
              data-testid="context-menu-item-clear"
              @click="clearSelectedRangeOfCells()"
            >
              <div v-e="['a:row:clear-range']" class="flex gap-2 items-center">
                <GeneralIcon icon="closeBox" class="text-gray-500" />
                {{ $t('general.clear') }} {{ $t('objects.cell').toLowerCase() }}
              </div>
            </NcMenuItem>

            <template v-if="contextMenuTarget && selectedRange.isSingleCell() && isUIAllowed('commentEdit') && !isMobileMode">
              <NcDivider />
              <NcMenuItem class="nc-base-menu-item" @click="commentRow(contextMenuTarget.row)">
                <div v-e="['a:row:comment']" class="flex gap-2 items-center">
                  <MdiMessageOutline class="h-4 w-4" />
                  {{ $t('general.add') }} {{ $t('general.comment').toLowerCase() }}
                </div>
              </NcMenuItem>
            </template>

            <template v-if="hasEditPermission && !isDataReadOnly">
              <NcDivider v-if="!(!contextMenuClosing && !contextMenuTarget && data.some((r) => r.rowMeta.selected))" />
              <NcMenuItem
                v-if="contextMenuTarget && (selectedRange.isSingleCell() || selectedRange.isSingleRow())"
                class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
                @click="confirmDeleteRow(contextMenuTarget.row)"
              >
                <div v-e="['a:row:delete']" class="flex gap-2 items-center">
                  <GeneralIcon icon="delete" />
                  <!-- Delete Row -->
                  {{ $t('activity.deleteRow') }}
                </div>
              </NcMenuItem>
              <NcMenuItem
                v-else-if="contextMenuTarget && deleteRangeOfRows"
                class="nc-base-menu-item !text-red-600 !hover:bg-red-50"
                @click="deleteSelectedRangeOfRows"
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
      </NcDropdown>
    </div>

    <div class="relative">
      <LazySmartsheetPagination
        v-if="headerOnly !== true && paginationDataRef && isGroupBy"
        :key="`nc-pagination-${isMobileMode}`"
        v-model:pagination-data="paginationDataRef"
        :show-api-timing="!isGroupBy"
        align-count-on-right
        :align-left="isGroupBy"
        :change-page="changePage"
        :hide-sidebars="paginationStyleRef?.hideSidebars === true"
        :fixed-size="paginationStyleRef?.fixedSize"
        :extra-style="paginationStyleRef?.extraStyle"
        :show-size-changer="!isGroupBy"
      >
        <template v-if="isAddingEmptyRowAllowed && !showSkeleton" #add-record>
          <div class="flex ml-1">
            <NcButton
              v-if="isMobileMode"
              v-e="[isAddNewRecordGridMode ? 'c:row:add:grid' : 'c:row:add:form']"
              class="nc-grid-add-new-row"
              type="secondary"
              :disabled="isPaginationLoading"
              @click.stop="onNewRecordToFormClick()"
            >
              {{ $t('activity.newRecord') }}
            </NcButton>
            <a-dropdown-button
              v-else
              v-e="[isAddNewRecordGridMode ? 'c:row:add:grid:toggle' : 'c:row:add:form:toggle']"
              class="nc-grid-add-new-row"
              placement="top"
              :disabled="isPaginationLoading"
              @click.stop="isAddNewRecordGridMode ? addEmptyRow() : onNewRecordToFormClick()"
            >
              <div data-testid="nc-pagination-add-record" class="flex items-center px-2 text-gray-600 hover:text-black">
                <span>
                  <template v-if="isAddNewRecordGridMode">
                    {{ $t('activity.newRecord') }}
                  </template>
                  <template v-else> {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }} </template>
                </span>
              </div>

              <template #overlay>
                <div class="relative overflow-visible min-h-17 w-10">
                  <div
                    class="absolute -top-21 flex flex-col min-h-34.5 w-70 p-1.5 bg-white rounded-lg border-1 border-gray-200 justify-start overflow-hidden"
                    style="box-shadow: 0px 4px 6px -2px rgba(0, 0, 0, 0.06), 0px -12px 16px -4px rgba(0, 0, 0, 0.1)"
                    :class="{
                      '-left-32.5': !isAddNewRecordGridMode,
                      '-left-21.5': isAddNewRecordGridMode,
                    }"
                  >
                    <div
                      v-e="['c:row:add:grid']"
                      class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer rounded-md hover:bg-gray-100 text-gray-600 nc-new-record-with-grid group"
                      @click="onNewRecordToGridClick"
                    >
                      <div class="flex flex-row items-center justify-between w-full">
                        <div class="flex flex-row items-center justify-start gap-x-2.5">
                          <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
                          {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
                        </div>

                        <GeneralIcon v-if="isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
                      </div>
                      <div class="flex flex-row text-xs text-gray-400 ml-6.5">
                        {{ $t('labels.addRowGrid') }}
                      </div>
                    </div>
                    <div
                      v-e="['c:row:add:form']"
                      class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer rounded-md hover:bg-gray-100 text-gray-600 nc-new-record-with-form group"
                      @click="onNewRecordToFormClick"
                    >
                      <div class="flex flex-row items-center justify-between w-full">
                        <div class="flex flex-row items-center justify-start gap-x-2.5">
                          <component :is="viewIcons[ViewTypes.FORM]?.icon" class="nc-view-icon text-inherit" />
                          {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }}
                        </div>

                        <GeneralIcon v-if="!isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
                      </div>
                      <div class="flex flex-row text-xs text-gray-400 ml-6.5">
                        {{ $t('labels.addRowForm') }}
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <template #icon>
                <component :is="iconMap.arrowUp" class="text-gray-600 h-4 w-4" />
              </template>
            </a-dropdown-button>
          </div>
        </template>
      </LazySmartsheetPagination>
      <LazySmartsheetGridPaginationV2
        v-else-if="paginationDataRef"
        v-model:pagination-data="paginationDataRef"
        :change-page="changePage"
        :show-size-changer="!isGroupBy"
        :scroll-left="scrollLeft"
      />
    </div>
    <div v-if="headerOnly !== true && paginationDataRef && !isGroupBy" class="absolute bottom-12 left-2" @click.stop>
      <NcDropdown v-if="isAddingEmptyRowAllowed && !showSkeleton">
        <div class="flex shadow-nc-sm rounded-lg">
          <NcButton
            v-if="isMobileMode"
            v-e="[isAddNewRecordGridMode ? 'c:row:add:grid' : 'c:row:add:form']"
            :disabled="isPaginationLoading"
            class="nc-grid-add-new-row"
            size="small"
            type="secondary"
            :shadow="false"
            @click.stop="onNewRecordToFormClick()"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              New Record
            </div>
          </NcButton>
          <NcButton
            v-else
            v-e="[isAddNewRecordGridMode ? 'c:row:add:grid' : 'c:row:add:form']"
            :disabled="isPaginationLoading"
            class="!rounded-r-none !border-r-0 nc-grid-add-new-row"
            size="small"
            type="secondary"
            :shadow="false"
            @click.stop="isAddNewRecordGridMode ? addEmptyRow() : onNewRecordToFormClick()"
          >
            <div data-testid="nc-pagination-add-record" class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              <template v-if="isAddNewRecordGridMode">
                {{ $t('activity.newRecord') }}
              </template>
              <template v-else> {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }} </template>
            </div>
          </NcButton>
          <NcButton
            v-if="!isMobileMode"
            size="small"
            class="!rounded-l-none nc-add-record-more-info"
            type="secondary"
            :shadow="false"
          >
            <GeneralIcon icon="arrowUp" />
          </NcButton>
        </div>

        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem v-e="['c:row:add:grid']" class="nc-new-record-with-grid group" @click="onNewRecordToGridClick">
              <div class="flex flex-row items-center justify-start gap-x-3">
                <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
                {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
              </div>

              <GeneralIcon v-if="isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
            </NcMenuItem>
            <NcMenuItem v-e="['c:row:add:form']" class="nc-new-record-with-form group" @click="onNewRecordToFormClick">
              <div class="flex flex-row items-center justify-start gap-x-3">
                <component :is="viewIcons[ViewTypes.FORM]?.icon" class="nc-view-icon text-inherit" />

                {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }}
              </div>

              <GeneralIcon v-if="!isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
  </div>
</template>

<style lang="scss">
.nc-grid-pagination-wrapper .ant-dropdown-button {
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

.predict-menu {
  .ant-dropdown-menu-title-content > div > div {
    @apply !w-full;
  }
}
</style>

<style scoped lang="scss">
.nc-grid-wrapper {
  @apply h-full w-full;

  .nc-grid-add-edit-column {
    @apply bg-gray-50;
  }

  .nc-grid-add-new-cell:hover td {
    @apply text-black !bg-gray-50;
  }

  td:not(.nc-grid-add-new-cell-item),
  th {
    @apply border-gray-100 border-solid border-r bg-gray-100 p-0;
    min-height: 32px !important;
    height: 32px !important;
    position: relative;
  }

  th {
    @apply border-b-1 border-gray-200;

    :deep(.name) {
      @apply text-small;
    }

    :deep(.nc-cell-icon),
    :deep(.nc-virtual-cell-icon) {
      @apply !w-3.5 !h-3.5 !text-small;
    }
  }

  .nc-grid-header th:last-child {
    @apply !border-b-1;
  }

  td:not(.nc-grid-add-new-cell-item) {
    @apply bg-white border-b;
  }

  td:not(:first-child):not(.nc-grid-add-new-cell-item) {
    @apply px-3;

    &.align-top {
      @apply py-2;

      &:has(.nc-cell.nc-cell-longtext textarea) {
        @apply py-0 pr-0;
      }
    }

    &.align-middle {
      @apply py-0;

      &:has(.nc-cell.nc-cell-longtext textarea) {
        @apply pr-0;
      }
    }

    & > div {
      overflow: hidden;
      @apply flex h-auto;
    }
    &.active-cell {
      :deep(.nc-cell) {
        a.nc-cell-field-link {
          @apply !text-brand-500;

          &:hover,
          .nc-cell-field {
            @apply !text-brand-500;
          }
        }
      }
    }
    :deep(.nc-cell),
    :deep(.nc-virtual-cell) {
      @apply !text-small;

      .nc-cell-field,
      input,
      textarea {
        @apply !text-small !pl-0 !py-0 m-0;
      }

      &:not(.nc-display-value-cell) {
        @apply text-gray-600;
        font-weight: 500;

        .nc-cell-field,
        input,
        textarea {
          @apply text-gray-600;
          font-weight: 500;
        }
      }

      .nc-cell-field,
      a.nc-cell-field-link,
      input,
      textarea {
        @apply !pl-0 !py-0 m-0;
      }

      a.nc-cell-field-link {
        @apply !text-current;
        &:hover {
          @apply !text-current;
        }
      }

      &.nc-cell-longtext {
        @apply leading-[18px];

        textarea {
          @apply pr-8 !py-2;
        }
      }

      .ant-picker-input {
        @apply text-small leading-4;
        font-weight: 500;

        input {
          @apply text-small leading-4;
          font-weight: 500;
        }
      }

      &.nc-cell-attachment {
        .nc-attachment-cell {
          .nc-attachment-wrapper {
            @apply !py-0.5;

            .nc-attachment {
              @apply !min-h-4;
            }
          }
        }
      }

      &.nc-cell-longtext .long-text-wrapper .nc-rich-text-grid {
        @apply pl-0 -ml-1;
      }

      .ant-select:not(.ant-select-customize-input) {
        .ant-select-selector {
          @apply !border-none flex-nowrap pr-4.5;
        }
        .ant-select-arrow,
        .ant-select-clear {
          @apply right-[3px];
        }
      }
      .ant-select-selection-search-input {
        @apply !h-[23px];
      }

      .ant-select-single:not(.ant-select-customize-input) .ant-select-selector {
        @apply !h-auto;
      }
    }
  }

  table {
    background-color: var(--nc-grid-bg);

    border-collapse: separate;
    border-spacing: 0;
  }

  td:not(.nc-grid-add-new-cell-item) {
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

  td.active.readonly::after {
    @apply text-primary bg-grey-50 bg-opacity-5 !border-gray-200;
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

  tbody td:not(.nc-grid-add-new-cell-item):nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 4;
    background: white;
  }

  .desktop {
    thead th:nth-child(2) {
      position: sticky !important;
      z-index: 5;
      left: 64px;
      @apply border-r-1 border-r-gray-200;
    }

    tbody tr:not(.nc-grid-add-new-cell) td:nth-child(2) {
      position: sticky !important;
      z-index: 4;
      left: 64px;
      background: white;
      @apply border-r-1 border-r-gray-100;
    }
  }

  .nc-grid-skeleton-loader {
    thead th:nth-child(2) {
      @apply border-r-1 !border-r-gray-50;
    }

    tbody td:not(.nc-grid-add-new-cell-item):nth-child(2) {
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
    @apply !xs:hidden w-full items-center justify-between;
  }

  .nc-expand {
    &:not(.nc-comment) {
      @apply hidden;
    }

    &.nc-comment {
      display: flex;
    }
  }

  &.active-row,
  &:not(.mouse-down):hover {
    .nc-row-no.toggle {
      @apply hidden;
    }

    .nc-expand {
      @apply flex;
    }

    .nc-row-expand-and-checkbox {
      @apply !xs:hidden flex;
    }

    &:not(.selected-row) {
      td.nc-grid-cell:not(.active),
      td:nth-child(2):not(.active) {
        @apply !bg-gray-50 border-b-gray-200 border-r-gray-200;
      }
    }
  }

  &.selected-row {
    td.nc-grid-cell:not(.active),
    td:nth-child(2):not(.active) {
      @apply !bg-[#F0F3FF] border-b-gray-200 border-r-gray-200;
    }
  }

  &:not(.selected-row):has(+ .selected-row) {
    td.nc-grid-cell:not(.active),
    td:nth-child(2):not(.active):not(.nc-grid-add-new-cell-item) {
      @apply border-b-gray-200;
    }
  }

  &:not(.active-row):has(+ .active-row),
  &:not(.mouse-down):has(+ :hover) {
    &:not(.selected-row) {
      td.nc-grid-cell:not(.active),
      td:nth-child(2):not(.active):not(.nc-grid-add-new-cell-item) {
        @apply border-b-gray-200;
      }
    }
  }
}

.nc-grid-header {
  &:hover {
    .nc-no-label {
      @apply hidden;
    }

    .nc-check-all {
      @apply flex;
    }
  }
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

:deep(.ant-skeleton-input) {
  @apply rounded text-gray-100 !bg-gray-100 !bg-opacity-65;
  animation: slow-show-1 5s ease 5s forwards;
}

.nc-grid-add-new-row {
  :deep(.ant-btn.ant-dropdown-trigger.ant-btn-icon-only) {
    @apply !flex items-center justify-center;
  }
}
</style>
