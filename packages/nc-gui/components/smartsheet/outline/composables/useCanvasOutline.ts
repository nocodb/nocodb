import type { ColumnType, FormulaType, GridColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, UITypes, isLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { SpriteLoader } from '../../grid/canvas/loaders/SpriteLoader'
import { getSingleMultiselectColOptions, getUserColOptions, parseCellWidth } from '../../grid/canvas/utils/cell'
import type { OutlineActiveCell, OutlineCanvasElement } from './types'
import {
  ADD_ROW_HEIGHT,
  BOTTOM_PADDING,
  CHEVRON_COL_WIDTH,
  DEPTH_DECREASE_GAP,
  DEPTH_INCREASE_GAP,
  INDENT_PER_DEPTH,
  OUTLINE_HEADER_HEIGHT,
  OUTLINE_ROW_HEIGHT,
  SUB_HEADER_HEIGHT,
} from './constants'
import { useCanvasRender } from './useCanvasRender'
import { useColumnResize } from './useColumnResize'
import { useOutlineDataFetch } from './useDataFetch'
import { useOutlineCellRenderer } from './useOutlineCellRenderer'
import { stringifyFilterOrSortArr } from '~/utils/dataUtils'
import type { OutlineViewRow } from '~/composables/useOutlineViewStore'

export function useCanvasOutline({
  scrollLeft,
  scrollTop,
  width,
  height,
  mousePosition,
}: {
  scrollLeft: Ref<number>
  scrollTop: Ref<number>
  width: Ref<number>
  height: Ref<number>
  mousePosition: { x: number; y: number }
}) {
  const { getColor } = useTheme()
  const { $api } = useNuxtApp()

  const { levels, displayLevels, isCollapsed, toggleCollapse, depthToLevelId, collapsedParents, isConfigured, selectedLevelId } =
    useOutlineViewStoreOrThrow()

  const { meta, view, nestedFilters, sorts } = useSmartsheetStoreOrThrow()
  const {
    fields: viewFields,
    gridViewCols,
    metaColumnById,
    showSystemFields,
    updateGridViewColumn,
    resizingColOldWith,
  } = useViewColumnsOrThrow()
  const { metas, getMeta } = useMetas()
  const { search, getValidSearchQueryForColumn } = useFieldQuery()

  const baseStore = useBase()
  const { sqlUis } = storeToRefs(baseStore)
  const { basesUser } = storeToRefs(useBases())

  const { isDataReadOnly, isUIAllowed } = useRoles()
  const { isAllowed } = usePermissions()
  const isPublicView = inject(IsPublicInj, ref(false))
  const isDataEditAllowed = computed(() => isUIAllowed('dataEdit') && !isPublicView.value)
  const isAddingEmptyRowAllowed = computed(() => isDataEditAllowed.value && !meta.value?.synced)

  const spriteLoader = new SpriteLoader(() => triggerRefreshCanvas())
  const canvasCursorRef = ref<CursorType>('')
  const setCursor: SetCursorType = (cursor) => {
    canvasCursorRef.value = cursor
  }
  const { isRowColouringEnabled, getEvaluatedRowMetaRowColorInfo } = useViewRowColorRender()

  const headerRowHeight = computed(() => OUTLINE_HEADER_HEIGHT)

  const rowHeight = computed(() => {
    const outlineView = view.value?.view as any
    const rh = outlineView?.row_height
    if (rh !== undefined) {
      const enumVal = [1, 2, 4, 6][rh] ?? 1
      return rowHeightInPx[`${enumVal}`] ?? OUTLINE_ROW_HEIGHT
    }
    return OUTLINE_ROW_HEIGHT
  })

  const elementMap = ref<OutlineCanvasElement[]>([])
  const hoverRow = ref<{ rowIndex: number }>({ rowIndex: -1 })
  const activeCell = ref<OutlineActiveCell | null>(null)
  const stickyHeaderDepth = ref(0)

  const viewId = computed(() => view.value?.id)

  const cachedRows = ref(new Map<number, OutlineViewRow>())
  const chunkStates = ref<Array<'loading' | 'loaded' | undefined>>([])
  const totalRows = ref(0)
  const levelCounts = ref<Record<string, number>>({})

  function getMetaForDepth(depth: number): TableType | undefined {
    const level = displayLevels.value[depth]
    if (!level?.fk_model_id) return undefined
    const baseId = meta.value?.base_id
    const metaKey = `${baseId}:${level.fk_model_id}`
    return metas.value?.[metaKey] as TableType | undefined
  }

  async function updateOrSaveRow(row: Row, property?: string): Promise<any> {
    if (!property) return

    const newVal = row.row[property]
    const oldVal = row.oldRow?.[property]
    if (newVal === oldVal) return

    const depth = row.row.__nc_depth ?? 0
    const depthMeta = getMetaForDepth(depth)
    if (!depthMeta) return

    const rowId = extractPkFromRow(row.row, depthMeta.columns as ColumnType[])
    if (!rowId) return

    try {
      const updatedRowData = await $api.dbTableRow.update(
        NOCO,
        depthMeta.base_id as string,
        depthMeta.id as string,
        encodeURIComponent(rowId),
        { [property]: newVal ?? null },
      )

      for (const [idx, cached] of cachedRows.value) {
        if (cached.__nc_pk === row.row.__nc_pk) {
          Object.assign(cached, updatedRowData)
          break
        }
      }
      triggerRefreshCanvas()
    } catch (e: any) {
      message.error(e.message || 'Failed to save')
    }
  }

  const { renderCell, handleCellClick, handleCellHover, imageLoader, actionManager } = useOutlineCellRenderer({
    spriteLoader,
    triggerRefreshCanvas: () => triggerRefreshCanvas(),
    setCursor,
    meta: meta as Ref<TableType | undefined>,
    cachedRows: cachedRows as Ref<Map<number, Row>>,
    totalRows,
    chunkStates,
    updateOrSaveRow,
  })

  // Collapsed state serialized for API calls
  const collapsedJson = computed(() => {
    const cp = collapsedParents.value
    const hasAny = Object.values(cp).some((arr) => arr.length > 0)
    return hasAny ? JSON.stringify(cp) : ''
  })

  const sharedViewPassword = inject(SharedViewPasswordInj, ref(''))

  function buildDraftFilterSortParams() {
    // For outline view, filters and sorts must be level-scoped (fk_level_id).
    // If a draft entry lacks fk_level_id, fall back to the currently selected level.
    const fallbackLevelId = selectedLevelId.value

    // Build search filter from the toolbar search bar.
    // SearchData.vue uses the selected level's columns for the field picker, so we look up
    // the column from that level's table meta and scope the filter to selectedLevelId.
    const searchFilters: any[] = []
    const searchQuery = search.value.query?.trim()
    if (searchQuery && search.value.field && fallbackLevelId) {
      const selectedLevel = levels.value.find((l) => l.id === fallbackLevelId)
      if (selectedLevel?.fk_model_id) {
        const baseId = (meta.value as any)?.base_id
        const levelMeta = metas.value?.[`${baseId}:${selectedLevel.fk_model_id}`] as any
        const col = levelMeta?.columns?.find((c: ColumnType) => c.id === search.value.field)
        if (col) {
          const result = getValidSearchQueryForColumn(col, searchQuery, levelMeta, { getWhereQueryAs: 'object' })
          if (result && typeof result === 'object' && 'fk_column_id' in result) {
            searchFilters.push({ ...result, fk_level_id: fallbackLevelId })
          }
        }
      }
    }

    const filterArrJson = isUIAllowed('filterSync')
      ? searchFilters.length
        ? stringifyFilterOrSortArr(searchFilters)
        : undefined
      : stringifyFilterOrSortArr([
          ...(nestedFilters.value ?? [])
            .filter((f) => !f.id)
            .map((f) => (f.fk_level_id ? f : { ...f, fk_level_id: fallbackLevelId })),
          ...searchFilters,
        ])

    const sortArrJson = isUIAllowed('sortSync')
      ? undefined
      : stringifyFilterOrSortArr(
          (sorts.value ?? []).filter((s) => !s.id).map((s) => (s.fk_level_id ? s : { ...s, fk_level_id: fallbackLevelId })),
        )

    return { filterArrJson, sortArrJson }
  }

  async function loadPage(params: { offset: number; limit: number; collapsed: string }): Promise<OutlineViewRow[]> {
    let response: any

    const { filterArrJson, sortArrJson } = buildDraftFilterSortParams()

    if (isPublicView.value) {
      const sharedViewUuid = view.value?.uuid
      if (!sharedViewUuid) return []

      const query: Record<string, any> = {
        limit: params.limit,
        offset: params.offset,
      }
      if (params.collapsed) query.collapsed = params.collapsed
      if (filterArrJson) query.filterArrJson = filterArrJson
      if (sortArrJson) query.sortArrJson = sortArrJson

      response = await $api.public.dataList(sharedViewUuid, query, {
        headers: {
          'xc-password': sharedViewPassword.value,
        },
      })
    } else {
      const workspaceId = (meta.value as any)?.fk_workspace_id
      const baseId = meta.value?.base_id
      if (!workspaceId || !baseId || !viewId.value) return []

      const query: Record<string, any> = {
        operation: 'outlineViewDataList',
        viewId: viewId.value,
        limit: params.limit,
        offset: params.offset,
      }
      if (params.collapsed) query.collapsed = params.collapsed
      if (filterArrJson) query.filterArrJson = filterArrJson
      if (sortArrJson) query.sortArrJson = sortArrJson

      response = await $api.internal.getOperation(workspaceId, baseId, query)
    }

    const rows = response.list || response?.data?.list || []

    if (isRowColouringEnabled.value) {
      for (const row of rows) {
        const colorInfo = getEvaluatedRowMetaRowColorInfo(row)
        row.__nc_color = colorInfo
      }
    }

    return rows
  }

  async function loadCount(params: { collapsed: string }): Promise<{ totalRows: number; counts: Record<string, number> }> {
    const { filterArrJson, sortArrJson } = buildDraftFilterSortParams()

    if (isPublicView.value) {
      const sharedViewUuid = view.value?.uuid
      if (!sharedViewUuid) return { totalRows: 0, counts: {} }

      const query: Record<string, any> = {}
      if (params.collapsed) query.collapsed = params.collapsed
      if (filterArrJson) query.filterArrJson = filterArrJson
      if (sortArrJson) query.sortArrJson = sortArrJson

      const response = await $api.public.dbViewRowCount(sharedViewUuid, query, {
        headers: {
          'xc-password': sharedViewPassword.value,
        },
      })
      return {
        totalRows: +(response.totalRows || 0),
        counts: (response as any).counts || {},
      }
    }

    const workspaceId = (meta.value as any)?.fk_workspace_id
    const baseId = meta.value?.base_id
    if (!workspaceId || !baseId || !viewId.value) return { totalRows: 0, counts: {} }

    const query: Record<string, any> = {
      operation: 'outlineViewDataCount',
      viewId: viewId.value,
    }
    if (params.collapsed) query.collapsed = params.collapsed
    if (filterArrJson) query.filterArrJson = filterArrJson
    if (sortArrJson) query.sortArrJson = sortArrJson

    const response = await $api.internal.getOperation(workspaceId, baseId, query)
    return {
      totalRows: +(response.totalRows || 0),
      counts: response.counts || {},
    }
  }

  const { fetchCount, updateVisibleRows, resetAndReload } = useOutlineDataFetch({
    viewId,
    cachedRows,
    chunkStates,
    totalRows,
    levelCounts,
    collapsedJson,
    loadPage,
    loadCount,
    triggerRefreshCanvas: () => triggerRefreshCanvas(),
  })

  const columnsPerLevel = computed<Record<string, CanvasGridColumn[]>>(() => {
    const result: Record<string, CanvasGridColumn[]> = {}

    for (const level of levels.value) {
      if (!level.id || !level.fk_model_id) continue

      const baseId = meta.value?.base_id
      const levelMetaKey = `${baseId}:${level.fk_model_id}`
      const levelMeta = metas.value?.[levelMetaKey] as TableType | undefined

      const levelFields = (viewFields.value || [])
        .filter((f: any) => {
          if (f.fk_level_id !== level.id || !f.show) return false
          const col = metaColumnById.value?.[f.fk_column_id!]
          if (!col) return false
          // Hide system columns unless showSystemFields is on (keep PV)
          if (!showSystemFields.value && isSystemColumn(col) && !col.pv) return false
          return true
        })
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))

      const cols: CanvasGridColumn[] = []

      const levelBaseUsers = baseId ? basesUser.value.get(baseId) || [] : []

      for (const f of levelFields) {
        const col = metaColumnById.value[f.fk_column_id!] as ColumnType
        if (!col) continue

        const viewCol = gridViewCols.value[f.fk_column_id] as GridColumnType | undefined

        let relatedColObj: ColumnType | undefined
        let relatedTableMeta: any

        if ([UITypes.Lookup, UITypes.Rollup].includes(col.uidt as UITypes)) {
          const lookupMetaKey = `${baseId}:${col.fk_model_id!}`
          relatedColObj = metas.value?.[lookupMetaKey]?.columns?.find(
            (c: ColumnType) => c.id === (col as any)?.colOptions?.fk_relation_column_id,
          ) as ColumnType

          if (relatedColObj && (relatedColObj as any).colOptions?.fk_related_model_id) {
            const relatedBaseId = ((relatedColObj as any).colOptions as any)?.fk_related_base_id || baseId
            const relatedMetaKey = `${relatedBaseId}:${(relatedColObj as any).colOptions.fk_related_model_id}`
            relatedTableMeta = metas.value?.[relatedMetaKey]
          }
        } else if (isLTAR(col.uidt as UITypes, (col as any).colOptions)) {
          const colOptions = (col as any).colOptions as LinkToAnotherRecordType
          if (colOptions?.fk_related_model_id) {
            const relatedBaseId = (colOptions as any)?.fk_related_base_id || baseId
            const ltarMetaKey = `${relatedBaseId}:${colOptions.fk_related_model_id}`
            relatedTableMeta = metas.value?.[ltarMetaKey]
          }
        }

        col.extra = {}

        if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(col.uidt as UITypes)) {
          col.extra = getSingleMultiselectColOptions(col)
        } else if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(col.uidt as UITypes)) {
          col.extra = getUserColOptions(col, levelBaseUsers)
        }

        if ([UITypes.LastModifiedTime, UITypes.CreatedTime, UITypes.DateTime].includes(col.uidt as UITypes)) {
          const colMeta = parseProp(col.meta)
          col.extra.timezone = isEeUI ? getTimeZoneFromName(colMeta?.timezone) : undefined
          col.extra.isDisplayTimezone = isEeUI ? colMeta?.isDisplayTimezone : undefined
        }

        if ([UITypes.Formula].includes(col.uidt as UITypes)) {
          const referencedColumn = (col.colOptions as FormulaType)?.parsed_tree?.referencedColumn
          const displayType = (col.meta as any)?.display_type ?? referencedColumn?.uidt
          const levelMeta = metas.value?.[`${baseId}:${col.fk_model_id!}`]
          const displayColumnConfig = (col.meta as any)?.display_type
            ? ((col.meta as any)?.display_column_meta as any)
            : referencedColumn
            ? levelMeta?.columns?.find((c: ColumnType) => c.id === referencedColumn.id)
            : undefined

          if ([UITypes.DateTime].includes(displayType) && displayColumnConfig?.meta) {
            const displayColumnConfigMeta = displayColumnConfig.meta
            displayColumnConfig.extra = {
              timezone:
                isEeUI && displayColumnConfigMeta.isDisplayTimezone
                  ? getTimeZoneFromName(displayColumnConfigMeta.timezone)
                  : undefined,
              isDisplayTimezone: isEeUI ? displayColumnConfigMeta.isDisplayTimezone : undefined,
            }
          }
          col.extra.display_type = displayType
          col.extra.display_column_meta = displayColumnConfig
        }

        const sqlUi = sqlUis.value[col.source_id!] ?? Object.values(sqlUis.value)[0]

        const isCellEditable =
          showReadonlyColumnTooltip(col) ||
          !showEditRestrictedColumnTooltip(col) ||
          isAllowed(PermissionEntity.FIELD, col.id, PermissionKey.RECORD_FIELD_EDIT)

        const isSyncedCol = !!(levelMeta?.synced && col.readonly)

        const isReadonly =
          col.readonly || isDataReadOnly.value || !isDataEditAllowed.value || isPublicView.value || !isCellEditable || isSyncedCol

        cols.push({
          id: col.id!,
          grid_column_id: viewCol?.id ?? col.id!,
          title: col.title!,
          uidt: col.uidt as any,
          width: viewCol?.width ?? '180px',
          fixed: false,
          pv: !!col.pv,
          virtual: isVirtualCol(col),
          readonly: isReadonly,
          isCellEditable,
          isSyncedColumn: isSyncedCol,
          columnObj: col as ColumnType & { extra?: any },
          relatedColObj,
          relatedTableMeta,
          aggregation: '',
          agg_fn: '',
          agg_prefix: '',
          abstractType: sqlUi?.getAbstractType(col) ?? null,
        })
      }

      result[level.id] = cols
    }

    return result
  })

  watch(
    columnsPerLevel,
    async (levels) => {
      const baseId = meta.value?.base_id
      if (!baseId) return

      for (const cols of Object.values(levels)) {
        for (const col of cols) {
          const columnObj = col.columnObj
          if (isLTAR(columnObj.uidt as UITypes, (columnObj as any).colOptions)) {
            const colOptions = (columnObj as any).colOptions as LinkToAnotherRecordType
            if (colOptions?.fk_related_model_id) {
              const relatedBaseId = (colOptions as any)?.fk_related_base_id || baseId
              const metaKey = `${relatedBaseId}:${colOptions.fk_related_model_id}`
              if (!metas.value?.[metaKey]) {
                await getMeta(colOptions.fk_related_model_id, false, false, relatedBaseId)
              }
            }
          } else if ([UITypes.Lookup, UITypes.Rollup].includes(columnObj.uidt as UITypes)) {
            const lookupMetaKey = `${baseId}:${columnObj.fk_model_id!}`
            const relatedColObj = metas.value?.[lookupMetaKey]?.columns?.find(
              (c: ColumnType) => c.id === (columnObj as any)?.colOptions?.fk_relation_column_id,
            )
            if (relatedColObj && (relatedColObj as any).colOptions?.fk_related_model_id) {
              const relatedBaseId = ((relatedColObj as any).colOptions as any)?.fk_related_base_id || baseId
              const metaKey = `${relatedBaseId}:${(relatedColObj as any).colOptions.fk_related_model_id}`
              if (!metas.value?.[metaKey]) {
                await getMeta((relatedColObj as any).colOptions.fk_related_model_id, false, false, relatedBaseId)
              }
            }
          }
        }
      }
    },
    { immediate: true },
  )

  const rootColumns = computed<CanvasGridColumn[]>(() => {
    const rootLevel = displayLevels.value[0]
    if (!rootLevel?.id) return []
    return columnsPerLevel.value[rootLevel.id] ?? []
  })

  function getColumnsForDepth(depth: number): CanvasGridColumn[] {
    const levelId = depthToLevelId.value[depth]
    if (!levelId) return []
    return columnsPerLevel.value[levelId] ?? []
  }

  const levelOrder = computed(() => displayLevels.value.map((l) => l.fk_model_id!))

  const scrollMetrics = computed(() => {
    const N = displayLevels.value.length
    if (N === 0 || totalRows.value === 0) {
      return { subHeaderCount: 0, rowCount: 0, addRowCount: 0, groups: [] as number[], scrollableHeight: 0 }
    }

    const cts = levelCounts.value
    const order = levelOrder.value

    const groups = new Array(N).fill(0)
    groups[0] = 1
    for (let d = 1; d < N; d++) {
      groups[d] = cts[order[d - 1]] || 0
    }

    const rowCount = totalRows.value

    // The render loop draws sub-headers in TWO places:
    // 1. Depth increase (non-first): entering a child group — one per non-root group
    // 2. Depth decrease: re-rendering column headers after closing children
    //
    // Add-rows are drawn for each closed level on depth decrease + trailing.
    // The root level (d=0) never gets an add-row (trailing loop uses d >= 1).
    //
    // Count of each transition type:
    const depthIncreaseCount = groups.slice(1).reduce((s: number, g: number) => s + g, 0)
    const depthDecreaseCount = Math.max(0, groups[N - 1] - 1)

    // Sub-headers: one per depth-increase + one per depth-decrease
    const subHeaderCount = depthIncreaseCount + depthDecreaseCount

    // Add-rows: exclude root group (root never gets an add-row)
    const addRowCount = isAddingEmptyRowAllowed.value ? groups.reduce((s: number, g: number) => s + g, 0) - 1 : 0

    // Gaps before sub-headers at depth boundaries
    const transitionGapHeight = depthIncreaseCount * DEPTH_INCREASE_GAP + depthDecreaseCount * DEPTH_DECREASE_GAP

    const scrollableHeight =
      subHeaderCount * SUB_HEADER_HEIGHT +
      rowCount * rowHeight.value +
      addRowCount * ADD_ROW_HEIGHT +
      transitionGapHeight +
      BOTTOM_PADDING

    return { subHeaderCount, rowCount, addRowCount, groups, scrollableHeight }
  })

  const totalHeight = computed(() => {
    if (totalRows.value === 0) return headerRowHeight.value
    return headerRowHeight.value + scrollMetrics.value.scrollableHeight
  })

  const slotHeight = computed(() => {
    if (totalRows.value === 0) return rowHeight.value
    return scrollMetrics.value.scrollableHeight / totalRows.value
  })

  const totalWidth = computed(() => {
    let maxWidth = width.value
    const maxDepth = displayLevels.value.length
    for (let d = 0; d < maxDepth; d++) {
      const cols = getColumnsForDepth(d)
      const indent = CHEVRON_COL_WIDTH + d * INDENT_PER_DEPTH
      const colsWidth = indent + cols.reduce((sum, c) => sum + parseCellWidth(c.width), 0)
      maxWidth = Math.max(maxWidth, colsWidth)
    }
    return maxWidth
  })

  const rowSlice = computed(() => {
    if (totalRows.value === 0) return { start: 0, end: 0 }

    const sh = slotHeight.value
    const hh = headerRowHeight.value
    const buffer = 3

    const adjustedScroll = Math.max(0, scrollTop.value - hh)
    const start = Math.max(0, Math.floor(adjustedScroll / sh) - buffer)
    const end = Math.min(totalRows.value, Math.ceil((adjustedScroll + height.value) / sh) + buffer)

    return { start, end }
  })

  const { canvasRef, renderCanvas } = useCanvasRender({
    width,
    height,
    scrollLeft,
    scrollTop,
    headerRowHeight,
    rowHeight,
    cachedRows,
    rowSlice,
    slotHeight,
    totalRows,
    hoverRow,
    mousePosition,
    elementMap,
    isCollapsed,
    displayLevels,
    getColumnsForDepth,
    getColor,
    meta,
    renderCell,
    stickyHeaderDepth,
    isAddingEmptyRowAllowed,
  })

  let rafId: number | null = null
  function triggerRefreshCanvas() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      renderCanvas()
      rafId = null
    })
  }

  watch([scrollTop, scrollLeft, width, height, rowHeight, () => totalRows.value, columnsPerLevel], () => triggerRefreshCanvas())

  watch(rowSlice, (slice) => updateVisibleRows(slice))
  watch(collapsedJson, () => resetAndReload())

  function findElementAt(x: number, y: number, type?: OutlineCanvasElement['type']): OutlineCanvasElement | null {
    for (let i = elementMap.value.length - 1; i >= 0; i--) {
      const el = elementMap.value[i]
      if (type && el.type !== type) continue
      if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
        return el
      }
    }
    return null
  }

  function resolveHeaderAt(x: number, y: number): { columns: CanvasGridColumn[]; startX: number } | null {
    // Sticky header: shows columns for the depth of the first visible row
    if (y >= 0 && y < headerRowHeight.value) {
      const d = stickyHeaderDepth.value
      const cols = getColumnsForDepth(d)
      const indent = CHEVRON_COL_WIDTH + d * INDENT_PER_DEPTH
      return {
        columns: cols,
        startX: indent - scrollLeft.value,
      }
    }

    // Sub-headers: check elementMap for 'header' type
    const headerEl = findElementAt(x, y, 'header')
    if (headerEl) {
      const cols = getColumnsForDepth(headerEl.depth)
      const indent = CHEVRON_COL_WIDTH + headerEl.depth * INDENT_PER_DEPTH
      return {
        columns: cols,
        startX: indent - scrollLeft.value,
      }
    }

    return null
  }

  const {
    isResizing,
    startResize,
    updateCursor: getResizeCursor,
  } = useColumnResize(
    canvasRef,
    triggerRefreshCanvas,
    resolveHeaderAt,
    // onResize: live local update during drag
    (columnId: string, newWidth: number) => {
      const widthStr = `${Math.round(newWidth)}px`
      if (gridViewCols.value[columnId]) {
        gridViewCols.value[columnId].width = widthStr
      }
      triggerRefreshCanvas()
    },
    // onResizeEnd: persist to server
    (columnId: string, newWidth: number) => {
      const widthStr = `${Math.round(newWidth)}px`
      if (gridViewCols.value[columnId]) {
        resizingColOldWith.value = gridViewCols.value[columnId].width || '180px'
        gridViewCols.value[columnId].width = widthStr
      }
      updateGridViewColumn(columnId, { width: widthStr })
    },
  )

  function handleCanvasMouseDown(e: MouseEvent) {
    if (startResize(e)) return
  }

  const expandRowHook = createEventHook<{ row: OutlineViewRow; depth: number }>()
  const addRowHook = createEventHook<{ depth: number; parentPk?: string | number }>()

  async function handleCanvasClick(e: MouseEvent) {
    if (isResizing.value) return

    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const expandEl = findElementAt(x, y, 'expandRow')
    if (expandEl) {
      const row = cachedRows.value.get(expandEl.rowIndex)
      if (row) {
        expandRowHook.trigger({ row, depth: expandEl.depth })
      }
      return
    }

    const cellEl = findElementAt(x, y, 'cell')
    if (cellEl && cellEl.columnId) {
      const row = cachedRows.value.get(cellEl.rowIndex)
      if (row) {
        const cols = getColumnsForDepth(cellEl.depth)
        const col = cols.find((c) => c.id === cellEl.columnId)
        if (col) {
          const rowObj: Row = { row: { ...row }, oldRow: { ...row }, rowMeta: { rowIndex: cellEl.rowIndex } }
          const cellPosition = { x: cellEl.x, y: cellEl.y, width: cellEl.width, height: cellEl.height }
          const handled = await handleCellClick({
            event: e,
            row: rowObj,
            column: col,
            value: row[col.title],
            mousePosition: { x, y },
            pk: row.__nc_pk,
            selected: false,
            imageLoader,
            path: [],
            cellPosition,
          })

          if (handled) {
            const cached = cachedRows.value.get(cellEl.rowIndex)
            if (cached) {
              Object.assign(cached, rowObj.row)
            }
            triggerRefreshCanvas()
            return
          }

          const canvasOnlyTypes = [UITypes.Checkbox, UITypes.Rating, UITypes.Button]
          if (canvasOnlyTypes.includes(col.columnObj.uidt as UITypes)) {
            return
          }

          activeCell.value = {
            rowIndex: cellEl.rowIndex,
            depth: cellEl.depth,
            column: col,
            row: { ...row },
            x: cellEl.x,
            y: cellEl.y,
            width: cellEl.width,
            height: cellEl.height,
          }
          return
        }
      }
    }

    const addRowEl = findElementAt(x, y, 'addRow')
    if (addRowEl) {
      addRowHook.trigger({ depth: addRowEl.depth, parentPk: addRowEl.parentPk })
      return
    }

    activeCell.value = null

    const chevron = findElementAt(x, y, 'chevron')
    if (chevron && chevron.pk !== undefined) {
      toggleCollapse(chevron.depth, String(chevron.pk))
    }
  }

  function handleCanvasMouseMove(e: MouseEvent) {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    mousePosition.x = x
    mousePosition.y = y

    canvasCursorRef.value = ''

    if (canvasRef.value) {
      const resizeCursor = getResizeCursor(x, y)
      if (resizeCursor) {
        canvasRef.value.style.cursor = resizeCursor
      } else {
        const expandEl = findElementAt(x, y, 'expandRow')
        const chevronEl = findElementAt(x, y, 'chevron')
        const addRowEl = findElementAt(x, y, 'addRow')

        if (expandEl || chevronEl || addRowEl) {
          canvasRef.value.style.cursor = 'pointer'
        } else {
          const cellEl = findElementAt(x, y, 'cell')
          if (cellEl?.columnId) {
            const row = cachedRows.value.get(cellEl.rowIndex)
            if (row) {
              const cols = getColumnsForDepth(cellEl.depth)
              const col = cols.find((c) => c.id === cellEl.columnId)
              if (col) {
                handleCellHover({
                  event: e,
                  row: { row: { ...row }, oldRow: { ...row }, rowMeta: {} },
                  column: col,
                  value: row[col.title],
                  mousePosition: { x, y },
                  pk: row.__nc_pk,
                  selected: false,
                  imageLoader,
                })
              }
            }
          }
          canvasRef.value.style.cursor = canvasCursorRef.value || ''
        }
      }
    }

    const rowEl = findElementAt(x, y, 'row')
    const newHoverIndex = rowEl?.rowIndex ?? -1

    const inHeader = y < headerRowHeight.value || findElementAt(x, y, 'header')
    if (inHeader) {
      triggerRefreshCanvas()
    } else if (newHoverIndex >= 0) {
      if (hoverRow.value.rowIndex !== newHoverIndex) {
        hoverRow.value = { rowIndex: newHoverIndex }
      }
      triggerRefreshCanvas()
    } else if (hoverRow.value.rowIndex !== newHoverIndex) {
      hoverRow.value = { rowIndex: newHoverIndex }
      triggerRefreshCanvas()
    }
  }

  function handleCanvasMouseLeave() {
    mousePosition.x = -1
    mousePosition.y = -1
    if (hoverRow.value.rowIndex !== -1) {
      hoverRow.value = { rowIndex: -1 }
    }
    triggerRefreshCanvas()
  }

  async function loadInitialData() {
    if (!isConfigured.value || !viewId.value) return

    await fetchCount()
    if (totalRows.value > 0) {
      updateVisibleRows({ start: 0, end: Math.ceil(height.value / rowHeight.value) + 5 })
    }
    nextTick(() => triggerRefreshCanvas())
  }

  onMounted(async () => {
    // Wait for levels + viewId to be available (view meta may load async)
    await waitForCondition(() => isConfigured.value && !!viewId.value, 100)
    // Wait a tick for the v-else template branch to render the canvas element
    await nextTick()
    await loadInitialData()
  })

  watch(
    () => levels.value.length,
    () => {
      if (isConfigured.value && viewId.value) {
        resetAndReload()
      }
    },
  )

  onBeforeUnmount(() => {
    if (rafId) cancelAnimationFrame(rafId)
  })

  return {
    canvasRef,
    triggerRefreshCanvas,
    resetAndReload,
    totalHeight,
    totalWidth,
    handleCanvasMouseDown,
    handleCanvasClick,
    handleCanvasMouseMove,
    handleCanvasMouseLeave,
    onExpandRow: expandRowHook.on,
    onAddRow: addRowHook.on,
    activeCell,
    cachedRows,
  }
}
