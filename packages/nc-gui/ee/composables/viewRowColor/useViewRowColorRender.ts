import { type ColumnType, ROW_COLORING_MODE, type TableType } from 'nocodb-sdk'
import { rowColouringCache } from '../../../components/smartsheet/grid/canvas/utils/canvas'
import { validateRowFilters } from '~/utils/dataUtils'

export function useViewRowColorRender(params: {
  meta?: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  /**
   * If useCachedResult is true then rows value will be empty array as we evaluate result on canvas render and store it in rowColouringCache
   */
  rows?: Ref<Record<string, any>[]> | ComputedRef<Record<string, any>[]>
  /**
   * If useCachedResult is true then we will use rowColouringCache to store the evaluated result
   */
  useCachedResult?: boolean
}) {
  const baseStore = useBase()
  const { getBaseType } = baseStore

  const { meta: activeTableMeta } = useSmartsheetStoreOrThrow()

  const meta = computed(() => {
    return params.meta?.value ?? activeTableMeta.value
  })

  const rows = computed(() => {
    return ncIsArray(params.rows?.value) ? params.rows?.value : []
  })

  const { activeViewRowColorInfo } = storeToRefs(useViewsStore())

  const isRowColouringEnabled = computed(() => {
    return activeViewRowColorInfo.value && !!activeViewRowColorInfo.value?.mode
  })

  const evaluateRowColor = (row: any) => {
    if (!activeViewRowColorInfo.value) return null

    if (activeViewRowColorInfo.value.mode === ROW_COLORING_MODE.SELECT) {
      const selectRowColorInfo = activeViewRowColorInfo.value

      if (!selectRowColorInfo || !selectRowColorInfo.selectColumn) {
        return null
      }

      const value = row[selectRowColorInfo.selectColumn.title]
      const rawColor: string | null | undefined = selectRowColorInfo.options.find((k) => k.title === value)?.color
      const color = rawColor ? getLighterTint(rawColor) : null
      const hoverColor = rawColor ? getLighterTint(rawColor, { brightnessMod: -3 }) : null
      const borderColor = rawColor ? getLighterTint(rawColor, { brightnessMod: -10 }) : null

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

      if (!filterRowColorInfo || !filterRowColorInfo.conditions) {
        return null
      }

      for (const eachCondition of filterRowColorInfo.conditions) {
        const isFilterValid = validateRowFilters(
          eachCondition.conditions,
          row,
          meta.value!.columns as ColumnType[],
          getBaseType(meta.value!.source_id),
          meta.value!,
        )

        if (isFilterValid) {
          const color: string | null | undefined = getLighterTint(eachCondition.color)

          const hoverColor = getLighterTint(eachCondition.color, { brightnessMod: -3 })

          const borderColor = getLighterTint(eachCondition.color, { brightnessMod: -10 })

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

  const evaluatedRowsColor = computed(() => {
    return rows.value
      .map((row) => {
        const evaluateResult = evaluateRowColor(toRaw(row))
        return {
          hash: getRowHash(row),
          ...evaluateResult,
        }
      })
      .reduce((obj, cur) => {
        obj[cur.hash] = cur
        if (cur && activeViewRowColorInfo.value) {
          cur.__eval_id = activeViewRowColorInfo.value.__id
        }
        return obj
      }, {})
  })

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

  const getLeftBorderColor = (row: any) => {
    if (!row || (!params.useCachedResult && !evaluatedRowsColor.value)) return null

    const rowHash = getRowHash(row)

    if (params.useCachedResult) {
      const cachedEvaluatedResult = getCachedEvaluatedResult(rowHash, row)

      return cachedEvaluatedResult?.rawColor ?? null
    } else {
      const evaluatedResult = evaluatedRowsColor.value[rowHash]

      return evaluatedResult?.rawColor ?? null
    }
  }

  const getRowColor = (row: any, isHovered: boolean = false) => {
    if (!row || (!params.useCachedResult && !evaluatedRowsColor.value)) return null

    const rowHash = getRowHash(row)

    if (params.useCachedResult) {
      const cachedEvaluatedResult = getCachedEvaluatedResult(rowHash, row)

      if (cachedEvaluatedResult?.is_set_as_background) {
        return isHovered ? cachedEvaluatedResult.hoverColor : cachedEvaluatedResult.color
      }
    } else {
      const evaluatedResult = evaluatedRowsColor.value[rowHash]

      if (evaluatedResult?.is_set_as_background) {
        return isHovered ? evaluatedResult.hoverColor : evaluatedResult.color
      }
    }

    return null
  }

  const getRowMetaRowColorInfo = (row: any) => {
    const result = {
      rowBgColor: null,
      rowLeftBorderColor: null,
    }

    if (!row) return result

    const evaluatedResult = evaluateRowColor(row)

    if (!evaluatedResult) return result

    return {
      rowBgColor: evaluatedResult?.is_set_as_background ? evaluatedResult?.color ?? null : null,
      rowLeftBorderColor: evaluatedResult?.rawColor ?? null,
      rowHoverColor: evaluatedResult?.hoverColor ?? null,
      rowBorderColor: evaluatedResult?.is_set_as_background ? evaluatedResult?.borderColor ?? null : null,
    }
  }

  return {
    rowColorInfo: activeViewRowColorInfo,
    evaluateRowColor,
    getLeftBorderColor,
    getRowColor,
    isRowColouringEnabled,
    getRowMetaRowColorInfo,
  }
}
