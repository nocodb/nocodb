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

  const evaluateRowColor = (row: any, columnId?: string) => {
    if (!isRowColouringEnabled.value) return null

    if (activeViewRowColorInfo.value.mode === ROW_COLORING_MODE.SELECT) {
      const selectRowColorInfo = activeViewRowColorInfo.value

      if (!selectRowColorInfo || !selectRowColorInfo.selectColumn) {
        return null
      }

      const value = row[selectRowColorInfo.selectColumn.title]
      const rawColor: string | null | undefined = selectRowColorInfo.options.find((k) => k.title === value)?.color
      const color = rawColor ? getAdaptiveTint(rawColor, { isDarkMode: isDark.value }) : null
      const hoverColor = rawColor
        ? getAdaptiveTint(rawColor, { brightnessMod: -3, isDarkMode: isDark.value, shade: isDark.value ? -6 : 0 })
        : null
      const borderColor = rawColor
        ? getAdaptiveTint(rawColor, { brightnessMod: -10, isDarkMode: isDark.value, shade: isDark.value ? -6 : 0 })
        : null

      return color
        ? {
            is_set_as_background: selectRowColorInfo.is_set_as_background,
            type: selectRowColorInfo.type || 'row',
            color,
            hoverColor,
            rawColor,
            borderColor,
          }
        : null
    }

    if (activeViewRowColorInfo.value.mode === ROW_COLORING_MODE.FILTER) {
      const filterRowColorInfo = activeViewRowColorInfo.value

      if (!filterRowColorInfo || !filterRowColorInfo.conditions || !meta.value) {
        return null
      }

      // When evaluating a specific cell, prioritize cell-type conditions over row-type
      const conditionsToCheck = columnId
        ? [
            // First check cell-type conditions for this column
            ...filterRowColorInfo.conditions.filter((c) => c.type === 'cell' && c.fk_target_column_id === columnId),
            // Then check row-type conditions
            ...filterRowColorInfo.conditions.filter((c) => c.type !== 'cell'),
          ]
        : // For row evaluation, only check row-type conditions
          filterRowColorInfo.conditions.filter((c) => c.type !== 'cell')

      for (const eachCondition of conditionsToCheck) {
        const isFilterValid = validateRowFilters(
          eachCondition.conditions,
          row,
          metaColumns.value as ColumnType[],
          getBaseType(meta.value!.source_id),
          metas.value,
          meta.value?.base_id,
          {
            currentUser: user.value ?? undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        )

        if (isFilterValid) {
          const color: string | null | undefined = getAdaptiveTint(eachCondition.color, {
            isDarkMode: isDark.value,
          })

          const hoverColor = getAdaptiveTint(eachCondition.color, {
            brightnessMod: -3,
            isDarkMode: isDark.value,
            shade: isDark.value ? -6 : 0,
          })

          const borderColor = getAdaptiveTint(eachCondition.color, {
            brightnessMod: -10,
            isDarkMode: isDark.value,
            shade: isDark.value ? -6 : 0,
          })

          return {
            is_set_as_background: eachCondition.is_set_as_background,
            type: eachCondition.type || 'row',
            fk_target_column_id: eachCondition.fk_target_column_id,
            color,
            hoverColor,
            rawColor: eachCondition.color,
            borderColor,
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
      const filterRowColorInfo = activeViewRowColorInfo.value

      // Get all cell-type conditions
      const cellConditions = filterRowColorInfo.conditions?.filter((c) => c.type === 'cell') || []

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
