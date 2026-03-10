import { type ColumnType, ROW_COLORING_MODE } from 'nocodb-sdk'

export function useViewRowColorRender() {
  const { isDark } = useTheme()

  const { getBaseType } = useBase()

  const { blockRowColoring, blockCellColoring } = useEeConfig()

  const { user } = useGlobal()

  const { meta } = useSmartsheetStoreOrThrow()

  const { metas } = useMetas()

  const { activeViewRowColorInfo } = storeToRefs(useViewsStore())

  const isRowColouringEnabled = computed(() => {
    return !blockRowColoring.value && activeViewRowColorInfo.value && !!activeViewRowColorInfo.value?.mode
  })

  const isCellColouringEnabled = computed(() => {
    if (blockCellColoring.value || !isRowColouringEnabled.value) return false

    // Only enable per-cell evaluation when cell-type conditions actually exist.
    // Without this check, every cell calls getEvaluatedCellColorInfo even when
    // there are only row-type conditions, wasting ~240 validateRowFilters calls per frame.
    if (activeViewRowColorInfo.value?.mode === ROW_COLORING_MODE.FILTER) {
      return activeViewRowColorInfo.value.conditions?.some((c) => c.type === 'cell') ?? false
    }

    return false
  })

  /**
   * In shared view meta.columns will include only visible columns so we have to use columnsById to get all columns
   */
  const metaColumns = computed(() => {
    return Object.values(meta.value?.columnsById ?? {})
  })

  // Cache timezone string — Intl.DateTimeFormat() construction is expensive (~50µs each).
  // Resolved once and reused across all validateRowFilters calls.
  const _cachedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // ---------------------------------------------------------------------------
  // Pre-computed color caches — computed once when conditions/isDark change,
  // eliminates ~150+ getAdaptiveTint (tinycolor) calls per chunk load.
  // ---------------------------------------------------------------------------

  /** FILTER mode: Map<conditionColor, {color, hoverColor, borderColor}> */
  const filterConditionColorCache = computed(() => {
    const info = activeViewRowColorInfo.value
    if (!info || info.mode !== ROW_COLORING_MODE.FILTER || !info.conditions) return new Map<string, any>()

    const dark = isDark.value
    const cache = new Map<string, any>()

    for (const condition of info.conditions) {
      if (!condition.color || cache.has(condition.color)) continue

      cache.set(condition.color, {
        color: getAdaptiveTint(condition.color, { isDarkMode: dark }),
        hoverColor: getAdaptiveTint(condition.color, { brightnessMod: -3, isDarkMode: dark, shade: dark ? -6 : 0 }),
        borderColor: getAdaptiveTint(condition.color, { brightnessMod: -10, isDarkMode: dark, shade: dark ? -6 : 0 }),
      })
    }

    return cache
  })

  /** SELECT mode: Map<optionTitle, {color, hoverColor, borderColor, rawColor}> + shared props */
  const selectColorCache = computed(() => {
    const info = activeViewRowColorInfo.value
    if (!info || info.mode !== ROW_COLORING_MODE.SELECT || !info.selectColumn || !info.options) return null

    const dark = isDark.value
    const map = new Map<string, any>()

    for (const opt of info.options) {
      if (!opt.color || !opt.title) continue
      map.set(opt.title, {
        color: getAdaptiveTint(opt.color, { isDarkMode: dark }),
        hoverColor: getAdaptiveTint(opt.color, { brightnessMod: -3, isDarkMode: dark, shade: dark ? -6 : 0 }),
        borderColor: getAdaptiveTint(opt.color, { brightnessMod: -10, isDarkMode: dark, shade: dark ? -6 : 0 }),
        rawColor: opt.color,
      })
    }

    return {
      map,
      is_set_as_background: info.is_set_as_background,
      type: info.type || 'row',
      columnTitle: info.selectColumn.title,
    }
  })

  // ---------------------------------------------------------------------------
  // Pre-filtered condition arrays — computed once when conditions change,
  // avoids per-row array allocations from .filter() calls.
  // ---------------------------------------------------------------------------

  /** Row-type conditions only (excludes cell-type) */
  const _rowConditions = computed(() => {
    const info = activeViewRowColorInfo.value
    if (!info || info.mode !== ROW_COLORING_MODE.FILTER || !info.conditions) return []
    return info.conditions.filter((c) => c.type !== 'cell')
  })

  /** Cell-type conditions only */
  const _cellConditions = computed(() => {
    const info = activeViewRowColorInfo.value
    if (!info || info.mode !== ROW_COLORING_MODE.FILTER || !info.conditions) return []
    return info.conditions.filter((c) => c.type === 'cell')
  })

  /** Cell-type conditions grouped by target column ID */
  const _cellConditionsByColumn = computed(() => {
    const map = new Map<string, any[]>()
    for (const c of _cellConditions.value) {
      if (!c.fk_target_column_id) continue
      let arr = map.get(c.fk_target_column_id)
      if (!arr) {
        arr = []
        map.set(c.fk_target_column_id, arr)
      }
      arr.push(c)
    }
    return map
  })

  // ---------------------------------------------------------------------------
  // Pre-cached base type — avoids repeated getBaseType(source_id) per row
  // ---------------------------------------------------------------------------
  const _cachedBaseType = computed(() => (meta.value ? getBaseType(meta.value.source_id) : null))

  // ---------------------------------------------------------------------------
  // Snapshot mechanism — caches reactive ref reads within the same synchronous
  // execution (e.g. a formatData loop over 50 rows). Auto-clears via microtask.
  // ---------------------------------------------------------------------------
  let _snapshot: {
    metaCols: ColumnType[]
    baseType: any
    metasVal: Record<string, any>
    baseId: string | undefined
    userVal: any
  } | null = null
  let _snapshotScheduledClear = false

  const _getSnapshot = () => {
    if (!_snapshot) {
      _snapshot = {
        metaCols: metaColumns.value as ColumnType[],
        baseType: _cachedBaseType.value,
        metasVal: metas.value,
        baseId: meta.value?.base_id,
        userVal: user.value ?? undefined,
      }
      if (!_snapshotScheduledClear) {
        _snapshotScheduledClear = true
        queueMicrotask(() => {
          _snapshot = null
          _snapshotScheduledClear = false
        })
      }
    }
    return _snapshot
  }

  const evaluateRowColor = (row: any, columnId?: string) => {
    if (!isRowColouringEnabled.value) return null

    if (activeViewRowColorInfo.value.mode === ROW_COLORING_MODE.SELECT) {
      const cache = selectColorCache.value
      if (!cache) return null

      const value = row[cache.columnTitle]
      const cached = cache.map.get(value)
      if (!cached) return null

      return {
        is_set_as_background: cache.is_set_as_background,
        type: cache.type,
        color: cached.color,
        hoverColor: cached.hoverColor,
        rawColor: cached.rawColor,
        borderColor: cached.borderColor,
      }
    }

    if (activeViewRowColorInfo.value.mode === ROW_COLORING_MODE.FILTER) {
      if (!meta.value) return null

      // Use pre-filtered condition arrays instead of .filter() per row
      let conditionsToCheck: any[]
      if (columnId) {
        const cellForCol = _cellConditionsByColumn.value.get(columnId) || []
        const rowConds = _rowConditions.value
        conditionsToCheck = cellForCol.length ? [...cellForCol, ...rowConds] : rowConds
      } else {
        conditionsToCheck = _rowConditions.value
      }

      if (!conditionsToCheck.length) return null

      // Snapshot reactive refs once per synchronous batch
      const snap = _getSnapshot()
      const colorCache = filterConditionColorCache.value

      for (const eachCondition of conditionsToCheck) {
        const isFilterValid = validateRowFilters(
          eachCondition.conditions,
          row,
          snap.metaCols,
          snap.baseType,
          snap.metasVal,
          snap.baseId,
          {
            currentUser: snap.userVal,
            timezone: _cachedTimezone,
          },
        )

        if (isFilterValid) {
          // Use pre-computed colors — avoids 3× tinycolor() per matching row
          const cached = colorCache.get(eachCondition.color)

          return {
            is_set_as_background: eachCondition.is_set_as_background,
            type: eachCondition.type || 'row',
            fk_target_column_id: eachCondition.fk_target_column_id,
            color: cached?.color ?? null,
            hoverColor: cached?.hoverColor ?? null,
            rawColor: eachCondition.color,
            borderColor: cached?.borderColor ?? null,
          }
        }
      }
    }

    return null
  }

  const getEvaluatedRowMetaRowColorInfo = (row: any) => {
    const result = {
      is_set_as_background: false,
      rowBgColor: null,
      rowLeftBorderColor: null,
      rowHoverColor: null,
      rowBorderColor: null,
      cellColors: {} as Record<string, any>,
    }

    if (!row || !isRowColouringEnabled.value) return result

    const rowColorResult = evaluateRowColor(row)

    // Pre-compute cell colors for all columns
    const cellColors: Record<string, any> = {}
    if (isCellColouringEnabled.value && activeViewRowColorInfo.value.mode === ROW_COLORING_MODE.FILTER) {
      // Use pre-filtered cell conditions instead of .filter() per row
      const cellConditions = _cellConditions.value

      // For each cell condition, evaluate and store in map
      for (const condition of cellConditions) {
        if (!condition.fk_target_column_id) continue

        const columnId = condition.fk_target_column_id

        // Skip if we already have a color for this column (precedence: first match wins)
        if (cellColors[columnId]) continue

        const cellColorResult = evaluateRowColor(row, columnId)

        if (cellColorResult && cellColorResult.type === 'cell') {
          cellColors[columnId] = {
            is_set_as_background: cellColorResult.is_set_as_background ?? false,
            cellBgColor: cellColorResult.is_set_as_background ? cellColorResult.color ?? null : null,
            cellBorderColor: cellColorResult.is_set_as_background ? cellColorResult.borderColor ?? null : null,
            cellHoverColor: cellColorResult.hoverColor ?? null,
            cellLeftBorderColor: cellColorResult.rawColor ?? null,
          }
        }
      }
    }

    return {
      is_set_as_background: rowColorResult?.is_set_as_background ?? false,
      rowBgColor: rowColorResult?.is_set_as_background ? rowColorResult?.color ?? null : null,
      rowLeftBorderColor: rowColorResult?.rawColor ?? null,
      rowHoverColor: rowColorResult?.hoverColor ?? null,
      rowBorderColor: rowColorResult?.is_set_as_background ? rowColorResult?.borderColor ?? null : null,
      cellColors,
    }
  }

  const getEvaluatedCellColorInfo = (row: any, columnId: string) => {
    const result = {
      is_set_as_background: false,
      cellBgColor: null as string | null,
      cellBorderColor: null as string | null,
      cellHoverColor: null as string | null,
      cellLeftBorderColor: null as string | null,
    }

    if (!row || !isRowColouringEnabled.value || !columnId) return result

    const cellColorResult = evaluateRowColor(row, columnId)

    if (!cellColorResult || cellColorResult.type !== 'cell') return result

    return {
      is_set_as_background: cellColorResult.is_set_as_background ?? false,
      cellBgColor: cellColorResult.is_set_as_background ? cellColorResult.color ?? null : null,
      cellBorderColor: cellColorResult.is_set_as_background ? cellColorResult.borderColor ?? null : null,
      cellHoverColor: cellColorResult.hoverColor ?? null,
      cellLeftBorderColor: cellColorResult.rawColor ?? null,
    }
  }

  const getCellColorStyle = (row: any, columnId: string) => {
    if (!isCellColouringEnabled.value || !columnId) return {}

    const cellColorInfo = getEvaluatedCellColorInfo(row, columnId)

    if (!cellColorInfo) return {}

    const style: Record<string, string> = {}

    if (cellColorInfo.cellBgColor) {
      style.backgroundColor = cellColorInfo.cellBgColor
    }

    return style
  }

  const getCellLeftBorderStyle = (row: any, columnId: string) => {
    if (!isCellColouringEnabled.value || !columnId) return null

    const cellColorInfo = getEvaluatedCellColorInfo(row, columnId)

    if (!cellColorInfo || cellColorInfo.is_set_as_background || !cellColorInfo.cellLeftBorderColor) return null

    return { backgroundColor: cellColorInfo.cellLeftBorderColor }
  }

  return {
    rowColorInfo: activeViewRowColorInfo,
    evaluateRowColor,
    isRowColouringEnabled,
    isCellColouringEnabled,
    getEvaluatedRowMetaRowColorInfo,
    getEvaluatedCellColorInfo,
    getCellColorStyle,
    getCellLeftBorderStyle,
  }
}
