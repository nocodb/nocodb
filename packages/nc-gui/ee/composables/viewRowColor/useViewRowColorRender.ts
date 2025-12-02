import { type ColumnType, ROW_COLORING_MODE } from 'nocodb-sdk'
import { rowColouringCache } from '../../../components/smartsheet/grid/canvas/utils/canvas'

export function useViewRowColorRender() {
  const { isDark } = useTheme()

  const { getBaseType } = useBase()

  const { blockRowColoring } = useEeConfig()

  const { user } = useGlobal()

  const { meta } = useSmartsheetStoreOrThrow()

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

  const evaluateRowColor = (row: any) => {
    if (!isRowColouringEnabled.value) return null

    if (activeViewRowColorInfo.value.mode === ROW_COLORING_MODE.SELECT) {
      const selectRowColorInfo = activeViewRowColorInfo.value

      if (!selectRowColorInfo || !selectRowColorInfo.selectColumn) {
        return null
      }

      const value = row[selectRowColorInfo.selectColumn.title]
      const rawColor: string | null | undefined = selectRowColorInfo.options.find((k) => k.title === value)?.color
      const color = rawColor ? getAdaptiveTint(rawColor, { isDarkMode: isDark.value }) : null
      const hoverColor = rawColor ? getAdaptiveTint(rawColor, { brightnessMod: -3, isDarkMode: isDark.value }) : null
      const borderColor = rawColor ? getAdaptiveTint(rawColor, { brightnessMod: -10, isDarkMode: isDark.value }) : null

      return color
        ? {
            is_set_as_background: selectRowColorInfo.is_set_as_background,
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
        const isFilterValid = validateRowFilters(
          eachCondition.conditions,
          row,
          metaColumns.value as ColumnType[],
          getBaseType(meta.value!.source_id),
          meta.value!,
          {
            currentUser: user.value ?? undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        )

        if (isFilterValid) {
          const color: string | null | undefined = getAdaptiveTint(eachCondition.color, {
            isDarkMode: isDark.value,
          })

          const hoverColor = getAdaptiveTint(eachCondition.color, { brightnessMod: -3, isDarkMode: isDark.value })

          const borderColor = getAdaptiveTint(eachCondition.color, { brightnessMod: -10, isDarkMode: isDark.value })

          return {
            is_set_as_background: eachCondition.is_set_as_background,
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

  const getCachedEvaluatedResult = (rowHash: string, row: any) => {
    const cachedEvaluatedResult = rowColouringCache.get(rowHash)

    if (!cachedEvaluatedResult) {
      const evaluatedResult = evaluateRowColor(row)
      if (evaluatedResult) {
        rowColouringCache.set(rowHash, evaluatedResult)
      }

      return evaluatedResult
    }

    return cachedEvaluatedResult
  }

  const getEvaluatedRowMetaRowColorInfo = (row: any) => {
    const result = {
      is_set_as_backgrounsd: false,
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

  return {
    rowColorInfo: activeViewRowColorInfo,
    evaluateRowColor,
    isRowColouringEnabled,
    getEvaluatedRowMetaRowColorInfo,
  }
}
