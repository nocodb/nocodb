import { type ColumnType, ROW_COLORING_MODE } from 'nocodb-sdk'
import { rowColouringCache } from '../../../components/smartsheet/grid/canvas/utils/canvas'

export function useViewRowColorRender() {
  const { isDark } = useTheme()

  const { getBaseType } = useBase()

  const { blockRowColoring } = useEeConfig()

  const { user } = useGlobal()

  const { meta } = useSmartsheetStoreOrThrow()

  const { metas } = useMetas()

  const { activeViewRowColorInfo } = storeToRefs(useViewsStore())

  const isRowColouringEnabled = computed(() => {
    return !blockRowColoring.value && activeViewRowColorInfo.value && !!activeViewRowColorInfo.value?.mode
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

      for (const eachCondition of filterRowColorInfo.conditions) {
        // For cell-type coloring, check if this condition applies to the specified column
        if (eachCondition.type === 'cell' && columnId && eachCondition.fk_target_column_id !== columnId) {
          continue
        }
        // For row-type coloring when checking a specific column, skip cell-specific conditions
        if (!columnId && eachCondition.type === 'cell') {
          continue
        }

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

  const getCachedEvaluatedResult = (rowHash: string, row: any, columnId?: string) => {
    const cacheKey = columnId ? `${rowHash}:${columnId}` : rowHash
    const cachedEvaluatedResult = rowColouringCache.get(cacheKey)

    if (!cachedEvaluatedResult) {
      const evaluatedResult = evaluateRowColor(row, columnId)
      if (evaluatedResult) {
        rowColouringCache.set(cacheKey, evaluatedResult)
      }

      return evaluatedResult
    }

    return cachedEvaluatedResult
  }

  const getEvaluatedRowMetaRowColorInfo = (row: any) => {
    const result = {
      is_set_as_background: false,
      rowBgColor: null,
      rowLeftBorderColor: null,
      rowHoverColor: null,
      rowBorderColor: null,
    }

    if (!row || !isRowColouringEnabled.value) return result

    const rowHash = getRowHash(row)

    const cachedEvaluatedResult = getCachedEvaluatedResult(rowHash, row)

    return {
      is_set_as_background: cachedEvaluatedResult?.is_set_as_background ?? false,
      rowBgColor: cachedEvaluatedResult?.is_set_as_background ? cachedEvaluatedResult?.color ?? null : null,
      rowLeftBorderColor: cachedEvaluatedResult?.rawColor ?? null,
      rowHoverColor: cachedEvaluatedResult?.hoverColor ?? null,
      rowBorderColor: cachedEvaluatedResult?.is_set_as_background ? cachedEvaluatedResult?.borderColor ?? null : null,
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

    const rowHash = getRowHash(row)
    const cellColorResult = getCachedEvaluatedResult(rowHash, row, columnId)

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
    if (!isRowColouringEnabled.value || !columnId) return {}
    const cellColorInfo = getEvaluatedCellColorInfo(row, columnId)
    if (!cellColorInfo) return {}
    const style: Record<string, string> = {}
    if (cellColorInfo.cellBgColor) {
      style.backgroundColor = cellColorInfo.cellBgColor
    }
    return style
  }

  const getCellLeftBorderStyle = (row: any, columnId: string) => {
    if (!isRowColouringEnabled.value || !columnId) return null
    const cellColorInfo = getEvaluatedCellColorInfo(row, columnId)
    if (!cellColorInfo || cellColorInfo.is_set_as_background || !cellColorInfo.cellLeftBorderColor) return null
    return { backgroundColor: cellColorInfo.cellLeftBorderColor }
  }

  return {
    rowColorInfo: activeViewRowColorInfo,
    evaluateRowColor,
    isRowColouringEnabled,
    getEvaluatedRowMetaRowColorInfo,
    getEvaluatedCellColorInfo,
    getCellColorStyle,
    getCellLeftBorderStyle,
  }
}
