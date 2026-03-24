import type { ColumnType, DataPayload, FilterType, FormulaType, GridColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { EventType, PermissionEntity, PermissionKey, RelationTypes, UITypes, isLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { ListActiveCell, ListCanvasElement } from './types'
import {
  ADD_ROW_HEIGHT,
  BOTTOM_PADDING,
  CHEVRON_COL_WIDTH,
  CHUNK_SIZE,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_FIRST_COLUMN_WIDTH,
  DEPTH_DECREASE_GAP,
  DEPTH_INCREASE_GAP,
  INDENT_PER_DEPTH,
  LIST_HEADER_HEIGHT,
  LIST_ROW_HEIGHT,
  RIGHT_PADDING,
  SUB_HEADER_HEIGHT,
} from './constants'
import { useCanvasRender } from './useCanvasRender'
import { useColumnResize } from './useColumnResize'
import { useListDataFetch } from './useDataFetch'
import { useListCellRenderer } from './useListCellRenderer'
import {
  collectRowAndDescendants,
  doesUpdateAffectSort,
  findCachedRowByPk,
  findSortedInsertIndex,
  insertRowsAt,
  pruneEmptyParents,
  removeRowsAndShift,
} from './listViewCache'
import { getSingleMultiselectColOptions, getUserColOptions, parseCellWidth } from '~/components/smartsheet/grid/canvas/utils/cell'
import { SpriteLoader } from '~/components/smartsheet/grid/canvas/loaders/SpriteLoader'
import { stringifyFilterOrSortArr, validateRowFilters } from '~/utils/dataUtils'
import type { ListViewRow } from '~/composables/useListViewStore'

export function useCanvasListView({
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
  const { $api, $ncSocket } = useNuxtApp()
  const { isMobileMode, user } = useGlobal()

  const {
    levels,
    displayLevels,
    isCollapsed,
    toggleCollapse,
    depthToLevelId,
    modelIdToDepth,
    collapsedParents,
    isConfigured,
    selectedLevelId,
  } = useListViewStoreOrThrow()

  const { meta, view, nestedFilters, sorts, allFilters } = useSmartsheetStoreOrThrow()
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
  const { getBaseType } = baseStore
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
  const { isRowColouringEnabled, getEvaluatedRowMetaRowColorInfo, rowColorInfo: activeViewRowColorInfo } = useViewRowColorRender()

  const headerRowHeight = computed(() => LIST_HEADER_HEIGHT)

  const rowHeight = computed(() => {
    const listView = view.value?.view as any
    const rh = listView?.row_height
    if (rh !== undefined) {
      const enumVal = [1, 2, 4, 6][rh] ?? 1
      return rowHeightInPx[`${enumVal}`] ?? LIST_ROW_HEIGHT
    }
    return LIST_ROW_HEIGHT
  })

  const elementMap = ref<ListCanvasElement[]>([])
  const hoverRow = ref<{ rowIndex: number }>({ rowIndex: -1 })
  const activeCell = ref<ListActiveCell | null>(null)
  const stickyHeaderDepth = ref(0)

  const viewId = computed(() => view.value?.id)

  const cachedRows = ref(new Map<number, ListViewRow>())
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

      // Find and update the cached row
      let cachedRowIndex: number | null = null
      for (const [idx, cached] of cachedRows.value) {
        if (cached.__nc_pk === row.row.__nc_pk && cached.__nc_depth === depth) {
          Object.assign(cached, updatedRowData)
          cachedRowIndex = idx
          break
        }
      }

      if (cachedRowIndex !== null) {
        const cachedRow = cachedRows.value.get(cachedRowIndex)!

        // Re-evaluate row color
        const leafDepth = displayLevels.value.length - 1
        if (depth === leafDepth && isRowColouringEnabled.value) {
          cachedRow.__nc_color = getEvaluatedRowMetaRowColorInfo(cachedRow)
        }

        // Re-validate against filters — remove if row no longer passes
        if (!validateRowForLevel(cachedRow, depth)) {
          const { indices, removedCounts } = collectRowAndDescendants(cachedRows.value, totalRows.value, cachedRowIndex, depth)
          removeRowsAndShift(cachedRows.value, chunkStates.value, indices)

          totalRows.value = Math.max(0, totalRows.value - indices.length)
          for (const [modelId, count] of Object.entries(removedCounts)) {
            if (levelCounts.value[modelId] !== undefined) {
              levelCounts.value[modelId] = Math.max(0, levelCounts.value[modelId] - count)
            }
          }

          if (cachedRow.__nc_parent_id && depth > 0) {
            pruneEmptyParents(cachedRows.value, chunkStates.value, totalRows, levelCounts.value, cachedRow.__nc_parent_id, depth - 1)
          }
        } else if (isSortAffected({ [property]: newVal }, depth)) {
          // Sort-affecting change — reposition the row among its siblings
          const { indices: subtreeIndices } = collectRowAndDescendants(cachedRows.value, totalRows.value, cachedRowIndex, depth)
          const subtreeRows: ListViewRow[] = subtreeIndices.map((i) => cachedRows.value.get(i)!).filter(Boolean)
          removeRowsAndShift(cachedRows.value, chunkStates.value, subtreeIndices)

          const parentPk = cachedRow.__nc_parent_id
          const parentIndex = depth > 0 && parentPk ? findCachedRowByPk(cachedRows.value, parentPk, depth - 1)?.index ?? null : null

          const newInsertAt = findSortedInsertIndex(cachedRows.value, totalRows.value, cachedRow, depth, parentIndex, getSortFieldsForDepth(depth), getColumnsByIdForDepth(depth))
          insertRowsAt(cachedRows.value, chunkStates.value, newInsertAt, subtreeRows)
        }
      }

      triggerRefreshCanvas()
    } catch (e: any) {
      message.error(e.message || 'Failed to save')
    }
  }

  const {
    renderCell,
    handleCellClick,
    handleCellHover,
    imageLoader,
    actionManager: _actionManager,
  } = useListCellRenderer({
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
    // For list view, filters and sorts must be level-scoped (fk_level_id).
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

  async function loadPage(params: { offset: number; limit: number; collapsed: string }): Promise<ListViewRow[]> {
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
        operation: 'listViewDataList',
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
      const leafDepth = displayLevels.value.length - 1
      for (const row of rows) {
        if (row.__nc_depth === leafDepth) {
          row.__nc_color = getEvaluatedRowMetaRowColorInfo(row)
        }
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
      operation: 'listViewDataCount',
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

  const { fetchCount, updateVisibleRows, resetAndReload } = useListDataFetch({
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

        // Build extra without mutating the reactive col object
        let extra: Record<string, any> = {}

        if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(col.uidt as UITypes)) {
          extra = getSingleMultiselectColOptions(col)
        } else if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(col.uidt as UITypes)) {
          extra = getUserColOptions(col, levelBaseUsers)
        }

        if ([UITypes.LastModifiedTime, UITypes.CreatedTime, UITypes.DateTime].includes(col.uidt as UITypes)) {
          const colMeta = parseProp(col.meta)
          extra.timezone = isEeUI ? getTimeZoneFromName(colMeta?.timezone) : undefined
          extra.isDisplayTimezone = isEeUI ? colMeta?.isDisplayTimezone : undefined
        }

        if ([UITypes.Formula].includes(col.uidt as UITypes)) {
          const referencedColumn = (col.colOptions as FormulaType)?.parsed_tree?.referencedColumn
          const displayType = (col.meta as any)?.display_type ?? referencedColumn?.uidt
          const formulaLevelMeta = metas.value?.[`${baseId}:${col.fk_model_id!}`]
          const displayColumnConfig = (col.meta as any)?.display_type
            ? ((col.meta as any)?.display_column_meta as any)
            : referencedColumn
            ? formulaLevelMeta?.columns?.find((c: ColumnType) => c.id === referencedColumn.id)
            : undefined

          let displayColumnExtra: Record<string, any> | undefined
          if ([UITypes.DateTime].includes(displayType) && displayColumnConfig?.meta) {
            const displayColumnConfigMeta = displayColumnConfig.meta
            displayColumnExtra = {
              timezone:
                isEeUI && displayColumnConfigMeta.isDisplayTimezone
                  ? getTimeZoneFromName(displayColumnConfigMeta.timezone)
                  : undefined,
              isDisplayTimezone: isEeUI ? displayColumnConfigMeta.isDisplayTimezone : undefined,
            }
          }
          extra.display_type = displayType
          extra.display_column_meta = displayColumnExtra
            ? { ...displayColumnConfig, extra: displayColumnExtra }
            : displayColumnConfig
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
          width: viewCol?.width ?? (col.pv ? `${DEFAULT_FIRST_COLUMN_WIDTH}px` : `${DEFAULT_COLUMN_WIDTH}px`),
          fixed: false,
          pv: !!col.pv,
          virtual: isVirtualCol(col),
          readonly: isReadonly,
          isCellEditable,
          isSyncedColumn: isSyncedCol,
          columnObj: { ...col, extra } as ColumnType & { extra?: any },
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

    // Add-rows: for multi-level, exclude root group (root never gets an add-row).
    // For single-level (N === 1), the root IS the leaf — include one add-row.
    const addRowCount = isAddingEmptyRowAllowed.value
      ? N === 1
        ? 1
        : groups.reduce((s: number, g: number) => s + g, 0) - 1
      : 0

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
    return (scrollMetrics.value.scrollableHeight - BOTTOM_PADDING) / totalRows.value
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
    // Add right padding only when content exceeds viewport (horizontal scroll active)
    if (maxWidth > width.value) {
      maxWidth += RIGHT_PADDING
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

  // Re-evaluate row colors when coloring config changes
  watch(
    () => activeViewRowColorInfo.value,
    () => {
      const leafDepth = displayLevels.value.length - 1
      for (const [_, row] of cachedRows.value) {
        if (row.__nc_depth === leafDepth) {
          row.__nc_color = isRowColouringEnabled.value ? getEvaluatedRowMetaRowColorInfo(row) : undefined
        } else {
          row.__nc_color = undefined
        }
      }
      triggerRefreshCanvas()
    },
    { deep: true },
  )

  function findElementAt(x: number, y: number, type?: ListCanvasElement['type']): ListCanvasElement | null {
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
    startResize(e)
  }

  const expandRowHook = createEventHook<{ row: ListViewRow; depth: number }>()
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
          // In mobile mode, open expanded form instead of inline editing
          if (isMobileMode.value) {
            expandRowHook.trigger({ row, depth: cellEl.depth })
            return
          }

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

  // ---------------------------------------------------------------------------
  // Realtime data event handling
  // ---------------------------------------------------------------------------
  const activeDataListeners = ref<string[]>([])

  /**
   * Get the filters scoped to a specific level, used for client-side row validation.
   * Combines saved filters (allFilters from smartsheet store) and any draft filters
   * from nestedFilters that haven't been synced yet.
   */
  function getFiltersForLevel(levelId: string): FilterType[] {
    const saved = (allFilters.value ?? []).filter((f: any) => f.fk_level_id === levelId)

    const draft = (nestedFilters.value ?? [])
      .filter((f: any) => !f.id && f.fk_level_id === levelId)

    return [...saved, ...draft] as FilterType[]
  }

  /**
   * Get the sorts scoped to a specific level.
   */
  function getSortsForLevel(levelId: string) {
    return (sorts.value ?? []).filter((s: any) => s.fk_level_id === levelId)
  }

  /**
   * Validate a row against the filters for its level.
   * Returns true if the row passes all filters (should be visible).
   */
  function validateRowForLevel(row: Record<string, any>, depth: number): boolean {
    const levelId = depthToLevelId.value[depth]
    if (!levelId) return true

    const filters = getFiltersForLevel(levelId)
    if (!filters.length) return true

    const depthMeta = getMetaForDepth(depth)
    if (!depthMeta?.columns) return true

    return validateRowFilters(
      filters,
      row,
      depthMeta.columns as ColumnType[],
      getBaseType(view.value?.source_id),
      metas.value,
      meta.value?.base_id,
      {
        currentUser: user.value,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    )
  }

  /**
   * Resolve the parent PK for a child row from its socket payload.
   * HM/BT: extracts FK value from payload. MM: returns null.
   */
  function resolveParentPkFromPayload(depth: number, payload: Record<string, any>): string | null {
    if (depth === 0) return null

    const parentLevel = displayLevels.value[depth - 1]
    const childLevel = displayLevels.value[depth]
    const linkColumnId = parentLevel?.fk_link_column_id || childLevel?.fk_link_column_id
    if (!linkColumnId) return null

    const parentMeta = getMetaForDepth(depth - 1)
    if (!parentMeta?.columns) return null

    const linkColumn = parentMeta.columns.find((c: ColumnType) => c.id === linkColumnId)
    const colOptions = (linkColumn as any)?.colOptions as LinkToAnotherRecordType | undefined
    if (!colOptions) return null

    if (colOptions.type === RelationTypes.HAS_MANY || colOptions.type === RelationTypes.BELONGS_TO) {
      const childMeta = getMetaForDepth(depth)
      if (!childMeta?.columns) return null

      const fkColumn = childMeta.columns.find((c: ColumnType) => c.id === colOptions.fk_child_column_id)
      if (!fkColumn?.title) return null

      const parentPk = payload[fkColumn.title]
      return parentPk != null ? String(parentPk) : null
    }

    return null
  }

  /** Build columnsById map for a given depth (used by sortByUIType). */
  function getColumnsByIdForDepth(depth: number): Record<string, ColumnType> {
    const depthMeta = getMetaForDepth(depth)
    if (!depthMeta?.columns) return {}
    const map: Record<string, ColumnType> = {}
    for (const col of depthMeta.columns) {
      if (col.id) map[col.id] = col
    }
    return map
  }

  /** Resolve sort fields for a depth, with fk_column_id for sortByUIType. */
  function getSortFieldsForDepth(depth: number): { title: string; fk_column_id: string; direction: 'asc' | 'desc' }[] {
    const levelId = depthToLevelId.value[depth]
    if (!levelId) return []

    const levelSorts = getSortsForLevel(levelId)
    const depthMeta = getMetaForDepth(depth)
    const columns = depthMeta?.columns as ColumnType[] | undefined
    if (!levelSorts.length || !columns) return []

    const fields: { title: string; fk_column_id: string; direction: 'asc' | 'desc' }[] = []
    for (const sort of levelSorts) {
      const col = columns.find((c) => c.id === sort.fk_column_id)
      if (col?.title && sort.fk_column_id) {
        fields.push({
          title: col.title,
          fk_column_id: sort.fk_column_id,
          direction: (sort.direction === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
        })
      }
    }
    return fields
  }

  function isSortAffected(payload: Record<string, any>, depth: number): boolean {
    const levelId = depthToLevelId.value[depth]
    if (!levelId) return false
    const levelSorts = getSortsForLevel(levelId)
    if (!levelSorts.length) return false
    return doesUpdateAffectSort(payload, levelSorts as any, getColumnsByIdForDepth(depth))
  }

  /**
   * Handle incoming data events from any table in the list view hierarchy.
   */
  function handleDataEvent(tableId: string, data: DataPayload) {
    if (isPublicView.value) return

    const depth = modelIdToDepth.value[tableId]
    if (depth === undefined) return

    const { id, action, payload } = data
    const levelId = depthToLevelId.value[depth]

    // Debug logging — remove after testing
    console.log(`[ListView RT] action=${action} id=${id} depth=${depth} tableId=${tableId}`, payload)

    if (action === 'add') {
      try {
        const filterResult = validateRowForLevel(payload, depth)
        console.log(`[ListView RT] ADD filter validation: ${filterResult}`, { levelId, filtersCount: getFiltersForLevel(levelId || '').length })
        if (!filterResult) return

        const leafDepth = displayLevels.value.length - 1

        const newRow: ListViewRow = {
          __nc_depth: depth,
          __nc_pk: id,
          __nc_parent_id: null,
          __nc_row_type: tableId,
          __nc_descendant_count: 0,
          ...payload,
        }

        // Evaluate row color for leaf-depth rows
        if (depth === leafDepth && isRowColouringEnabled.value) {
          newRow.__nc_color = getEvaluatedRowMetaRowColorInfo(payload)
        }

        let insertAt: number

        if (depth === 0) {
          // Root level: find sorted position among depth-0 siblings
          insertAt = findSortedInsertIndex(cachedRows.value, totalRows.value, newRow, depth, null, getSortFieldsForDepth(depth), getColumnsByIdForDepth(depth))
        } else {
          // Non-root: resolve parent PK from the payload's FK column
          const parentPk = resolveParentPkFromPayload(depth, payload)
          if (!parentPk) {
            // MM link or couldn't resolve parent — update counts only.
            if (levelCounts.value[tableId] !== undefined) {
              levelCounts.value[tableId]++
            }
            totalRows.value++
            triggerRefreshCanvas()
            return
          }

          newRow.__nc_parent_id = parentPk

          // Collapsed parent — don't insert visually, just update counts
          if (isCollapsed(depth - 1, parentPk)) {
            if (levelCounts.value[tableId] !== undefined) {
              levelCounts.value[tableId]++
            }
            totalRows.value++
            triggerRefreshCanvas()
            return
          }

          // Check if parent exists in cache
          const parent = findCachedRowByPk(cachedRows.value, parentPk, depth - 1)
          if (!parent) {
            // Parent was pruned — update counts; will appear on next scroll/refetch.
            if (levelCounts.value[tableId] !== undefined) {
              levelCounts.value[tableId]++
            }
            totalRows.value++
            triggerRefreshCanvas()
            return
          }

          // Find sorted position among siblings under this parent
          insertAt = findSortedInsertIndex(cachedRows.value, totalRows.value, newRow, depth, parent.index, getSortFieldsForDepth(depth), getColumnsByIdForDepth(depth))
        }

        // Check if insertion point falls within the cached window
        const cachedKeys = Array.from(cachedRows.value.keys())
        const cacheMin = cachedKeys.length ? Math.min(...cachedKeys) : 0
        const cacheMax = cachedKeys.length ? Math.max(...cachedKeys) : -1

        if (insertAt < cacheMin && cacheMin > 0) {
          // Row goes BEFORE the cached window (there's an evicted gap at start) —
          // don't insert, just shift cached indices down by 1
          const entries = Array.from(cachedRows.value.entries()).sort((a, b) => b[0] - a[0])
          for (const [idx, row] of entries) {
            cachedRows.value.delete(idx)
            cachedRows.value.set(idx + 1, row)
          }
          const startChunk = Math.floor(cacheMin / CHUNK_SIZE)
          for (let c = startChunk; c < chunkStates.value.length; c++) {
            chunkStates.value[c] = undefined
          }
        } else if (insertAt > cacheMax && cacheMax < totalRows.value - 1) {
          // Row goes AFTER the cached window (there's an evicted gap at end) —
          // no cache mutation needed
        } else {
          // Row falls WITHIN the cached range (or cache covers full range) — insert it
          insertRowsAt(cachedRows.value, chunkStates.value, insertAt, [newRow])
        }

        totalRows.value++
        if (levelCounts.value[tableId] !== undefined) {
          levelCounts.value[tableId]++
        }

        triggerRefreshCanvas()
      } catch (e) {
        console.error('List view: failed to handle add event', e)
      }
    } else if (action === 'update') {
      try {
        let found = false
        for (const [rowIndex, cachedRow] of cachedRows.value.entries()) {
          if (String(cachedRow.__nc_pk) === String(id) && cachedRow.__nc_depth === depth) {
            console.log(`[ListView RT] UPDATE found row at index=${rowIndex} pk=${id}`, { before: { ...cachedRow }, payload })

            // Apply the update
            Object.assign(cachedRow, payload)

            // Re-evaluate row color
            const leafDepth = displayLevels.value.length - 1
            if (depth === leafDepth && isRowColouringEnabled.value) {
              cachedRow.__nc_color = getEvaluatedRowMetaRowColorInfo(cachedRow)
            }

            // Re-validate against filters — remove if row no longer passes
            const filterResult = validateRowForLevel(cachedRow, depth)
            const sortResult = isSortAffected(payload, depth)
            console.log(`[ListView RT] UPDATE validation: filterPasses=${filterResult} sortAffected=${sortResult}`, { levelId, filtersCount: getFiltersForLevel(levelId || '').length, after: { ...cachedRow } })

            if (!filterResult) {
              // If this is a parent, remove it and all its descendants
              const { indices, removedCounts } = collectRowAndDescendants(cachedRows.value, totalRows.value, rowIndex, depth)
              removeRowsAndShift(cachedRows.value, chunkStates.value, indices)

              totalRows.value = Math.max(0, totalRows.value - indices.length)
              for (const [modelId, count] of Object.entries(removedCounts)) {
                if (levelCounts.value[modelId] !== undefined) {
                  levelCounts.value[modelId] = Math.max(0, levelCounts.value[modelId] - count)
                }
              }

              // Check if this row's parent is now childless → prune cascade
              if (cachedRow.__nc_parent_id && depth > 0) {
                pruneEmptyParents(cachedRows.value, chunkStates.value, totalRows, levelCounts.value, cachedRow.__nc_parent_id, depth - 1)
              }
            } else if (levelId && payload) {
              // Row still passes filters — check if sort position needs to change
              if (isSortAffected(payload, depth)) {
                // Remove the row (and its subtree) from current position
                const { indices: subtreeIndices } = collectRowAndDescendants(cachedRows.value, totalRows.value, rowIndex, depth)
                const subtreeRows: ListViewRow[] = subtreeIndices.map((i) => cachedRows.value.get(i)!).filter(Boolean)
                removeRowsAndShift(cachedRows.value, chunkStates.value, subtreeIndices)

                // Find the parent index (may have shifted after removal)
                const parentPk = cachedRow.__nc_parent_id
                const parentIndex = depth > 0 && parentPk ? findCachedRowByPk(cachedRows.value, parentPk, depth - 1)?.index ?? null : null

                // Find new sorted position and re-insert the entire subtree
                const newInsertAt = findSortedInsertIndex(cachedRows.value, totalRows.value, cachedRow, depth, parentIndex, getSortFieldsForDepth(depth), getColumnsByIdForDepth(depth))
                console.log(`[ListView RT] UPDATE sort reposition: removed ${subtreeIndices.length} rows, reinserting at ${newInsertAt} (parentIndex=${parentIndex})`)
                insertRowsAt(cachedRows.value, chunkStates.value, newInsertAt, subtreeRows)
              }
            }

            found = true
            break
          }
        }

        if (!found && payload) {
          console.log(`[ListView RT] UPDATE row NOT found in cache, checking if it should be added`, { id, depth, payloadKeys: Object.keys(payload) })
          if (!validateRowForLevel(payload, depth)) {
            console.log(`[ListView RT] UPDATE not-found: filter validation failed, ignoring`)
            triggerRefreshCanvas()
            return
          }

          // Determine where this row would be inserted
          let parentIndex: number | null = null
          let parentPk: string | null = null

          if (depth > 0) {
            parentPk = resolveParentPkFromPayload(depth, payload)
            if (parentPk) {
              const parent = findCachedRowByPk(cachedRows.value, parentPk, depth - 1)
              parentIndex = parent?.index ?? null
            }
          }

          // If parent isn't in cache (pruned or MM), just bump counts
          if (depth > 0 && parentIndex === null) {
            totalRows.value++
            if (levelCounts.value[tableId] !== undefined) {
              levelCounts.value[tableId]++
            }
            triggerRefreshCanvas()
            return
          }

          const insertAt = findSortedInsertIndex(cachedRows.value, totalRows.value, payload, depth, parentIndex, getSortFieldsForDepth(depth), getColumnsByIdForDepth(depth))

          // Determine the currently cached index range
          const cachedKeys = Array.from(cachedRows.value.keys())
          const cacheMin = cachedKeys.length ? Math.min(...cachedKeys) : 0
          const cacheMax = cachedKeys.length ? Math.max(...cachedKeys) : -1

          if (insertAt < cacheMin && cacheMin > 0) {
            // Row goes BEFORE the cached window — shift indices, don't insert
            const entries = Array.from(cachedRows.value.entries()).sort((a, b) => b[0] - a[0])
            for (const [idx, row] of entries) {
              cachedRows.value.delete(idx)
              cachedRows.value.set(idx + 1, row)
            }
            const startChunk = Math.floor(cacheMin / CHUNK_SIZE)
            for (let c = startChunk; c < chunkStates.value.length; c++) {
              chunkStates.value[c] = undefined
            }
          } else if (insertAt > cacheMax && cacheMax < totalRows.value - 1) {
            // Row goes AFTER the cached window — no cache changes needed
          } else {
            // Row falls WITHIN the cached range — insert it
            const leafDepth = displayLevels.value.length - 1
            const newRow: ListViewRow = {
              __nc_depth: depth,
              __nc_pk: id,
              __nc_parent_id: parentPk,
              __nc_row_type: tableId,
              __nc_descendant_count: 0,
              ...payload,
            }
            if (depth === leafDepth && isRowColouringEnabled.value) {
              newRow.__nc_color = getEvaluatedRowMetaRowColorInfo(payload)
            }
            insertRowsAt(cachedRows.value, chunkStates.value, insertAt, [newRow])
          }

          totalRows.value++
          if (levelCounts.value[tableId] !== undefined) {
            levelCounts.value[tableId]++
          }
        }

        triggerRefreshCanvas()
      } catch (e) {
        console.error('List view: failed to handle update event', e)
      }
    } else if (action === 'delete') {
      try {
        console.log(`[ListView RT] DELETE id=${id} depth=${depth}`)
        for (const [rowIndex, cachedRow] of cachedRows.value.entries()) {
          if (String(cachedRow.__nc_pk) === String(id) && cachedRow.__nc_depth === depth) {
            console.log(`[ListView RT] DELETE found at index=${rowIndex}`)
            const parentId = cachedRow.__nc_parent_id

            // Remove this row and all its descendants (if it's a parent)
            const { indices, removedCounts } = collectRowAndDescendants(cachedRows.value, totalRows.value, rowIndex, depth)
            removeRowsAndShift(cachedRows.value, chunkStates.value, indices)

            totalRows.value = Math.max(0, totalRows.value - indices.length)
            for (const [modelId, count] of Object.entries(removedCounts)) {
              if (levelCounts.value[modelId] !== undefined) {
                levelCounts.value[modelId] = Math.max(0, levelCounts.value[modelId] - count)
              }
            }

            // Check if this row's parent is now childless → prune cascade
            if (parentId && depth > 0) {
              pruneEmptyParents(cachedRows.value, chunkStates.value, totalRows, levelCounts.value, parentId, depth - 1)
            }

            break
          }
        }

        triggerRefreshCanvas()
      } catch (e) {
        console.error('List view: failed to handle delete event', e)
      }
    } else if (action === 'reorder') {
      try {
        const { before } = data

        // Find the row being reordered
        for (const [rowIndex, cachedRow] of cachedRows.value.entries()) {
          if (String(cachedRow.__nc_pk) === String(id) && cachedRow.__nc_depth === depth) {
            // Remove the row and its subtree from current position
            const { indices: subtreeIndices } = collectRowAndDescendants(cachedRows.value, totalRows.value, rowIndex, depth)
            const subtreeRows: ListViewRow[] = subtreeIndices.map((i) => cachedRows.value.get(i)!).filter(Boolean)
            removeRowsAndShift(cachedRows.value, chunkStates.value, subtreeIndices)

            // Update row data if payload has changes
            if (payload && typeof payload === 'object') {
              Object.assign(subtreeRows[0], payload)
            }

            // Find target position using 'before' PK
            let targetIndex: number

            if (before) {
              const beforeRow = findCachedRowByPk(cachedRows.value, String(before), depth)
              targetIndex = beforeRow ? beforeRow.index : totalRows.value
            } else {
              const parentPk = cachedRow.__nc_parent_id
              const parentIndex = depth > 0 && parentPk ? findCachedRowByPk(cachedRows.value, parentPk, depth - 1)?.index ?? null : null
              targetIndex = findSortedInsertIndex(cachedRows.value, totalRows.value, cachedRow, depth, parentIndex, getSortFieldsForDepth(depth), getColumnsByIdForDepth(depth))
            }

            insertRowsAt(cachedRows.value, chunkStates.value, targetIndex, subtreeRows)
            break
          }
        }

        triggerRefreshCanvas()
      } catch (e) {
        console.error('List view: failed to handle reorder event', e)
      }
    }
  }

  /**
   * Subscribe to DATA_EVENT for all tables in the list view level hierarchy.
   */
  watch(
    () => displayLevels.value.map((l) => l.fk_model_id).join(','),
    (newKey, oldKey) => {
      if (newKey === oldKey) return

      for (const listenerId of activeDataListeners.value) {
        $ncSocket.offMessage(listenerId)
      }
      activeDataListeners.value = []

      const workspaceId = (meta.value as any)?.fk_workspace_id
      const baseId = meta.value?.base_id
      if (!workspaceId || !baseId) return

      for (const level of displayLevels.value) {
        const tableId = level.fk_model_id
        if (!tableId) continue

        const eventKey = `${EventType.DATA_EVENT}:${workspaceId}:${baseId}:${tableId}`
        const listenerId = $ncSocket.onMessage(eventKey, (data: DataPayload) => {
          handleDataEvent(tableId, data)
        })
        activeDataListeners.value.push(listenerId)
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (rafId) cancelAnimationFrame(rafId)

    for (const listenerId of activeDataListeners.value) {
      $ncSocket.offMessage(listenerId)
    }
    activeDataListeners.value = []
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
