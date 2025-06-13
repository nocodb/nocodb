import { type ColumnType, ROW_COLORING_MODE, type RowColoringInfo, type TableType, type ViewType } from 'nocodb-sdk'
import { validateRowFilters } from '~/utils/dataUtils'
import { rowColouringCache } from '../../../components/smartsheet/grid/canvas/utils/canvas'
import { defaultRowColorInfo } from './useViewRowColorProvider'

export function useViewRowColorRender(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  /**
   * If it is grid canvas then rows value will be empty array as we evaluate result on canvas render and store it in rowColouringCache
   */
  rows: Ref<Ref<Record<string, any>>[]>
  /**
   * If it is grid canvas then we will use rowColouringCache to store the evaluated result
   */
  isGridCanvas?: boolean
}) {
  const baseStore = useBase()
  const { getBaseType } = baseStore

  const rowColorInfo: Ref<RowColoringInfo> = inject(ViewRowColorInj, ref(defaultRowColorInfo))

  const isRowColouringEnabled = computed(() => {
    return rowColorInfo.value && !!rowColorInfo.value?.mode
  })

  const evaluateRowColor = (row: any) => {
    if (rowColorInfo.value && rowColorInfo.value.mode === ROW_COLORING_MODE.SELECT) {
      const selectRowColorInfo = rowColorInfo.value
      if (!selectRowColorInfo || !selectRowColorInfo.selectColumn) {
        return null
      }
      const value = row[selectRowColorInfo.selectColumn.title]
      const rawColor: string | null | undefined = selectRowColorInfo.options.find((k) => k.title === value)?.color
      const color = rawColor ? getLighterTint(rawColor) : null
      return color
        ? {
            is_set_as_background: selectRowColorInfo.is_set_as_background,
            color,
            rawColor,
          }
        : null
    } else if (rowColorInfo.value && rowColorInfo.value.mode === ROW_COLORING_MODE.FILTER) {
      const filterRowColorInfo = rowColorInfo.value
      if (!filterRowColorInfo || !filterRowColorInfo.conditions) {
        return null
      }
      for (const eachCondition of filterRowColorInfo.conditions) {
        const isFilterValid = validateRowFilters(
          eachCondition.conditions,
          row,
          params.meta.value!.columns as ColumnType[],
          getBaseType(params.meta.value!.source_id),
          params.meta.value!,
        )

        if (isFilterValid) {
          const color: string | null | undefined = getLighterTint(eachCondition.color)
          return {
            is_set_as_background: eachCondition.is_set_as_background,
            color,
            rawColor: eachCondition.color,
          }
        }
      }
    }
    return null
  }

  const evaluatedRowsColor = computed(() => {
    return params.rows.value
      .map((row) => {
        const evaluateResult = evaluateRowColor(toRaw(row))
        return {
          hash: getRowHash(row),
          ...evaluateResult,
        }
      })
      .reduce((obj, cur) => {
        obj[cur.hash] = cur
        if (cur && rowColorInfo.value) {
          cur.__eval_id = rowColorInfo.value.__id
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
    if (!row || (!params.isGridCanvas && !evaluatedRowsColor.value)) return null

    const rowHash = getRowHash(row)

    if (params.isGridCanvas) {
      const cachedEvaluatedResult = getCachedEvaluatedResult(rowHash, row)

      return cachedEvaluatedResult?.rawColor ?? null
    } else {
      const evaluatedResult = evaluatedRowsColor.value[rowHash]

      return evaluatedResult?.rawColor ?? null
    }
  }

  const getRowColor = (row: any) => {
    if (!row || (!params.isGridCanvas && !evaluatedRowsColor.value)) return null

    const rowHash = getRowHash(row)

    if (params.isGridCanvas) {
      const cachedEvaluatedResult = getCachedEvaluatedResult(rowHash, row)

      if (cachedEvaluatedResult?.is_set_as_background) {
        return cachedEvaluatedResult.color
      }
    } else {
      const evaluatedResult = evaluatedRowsColor.value[rowHash]

      if (evaluatedResult?.is_set_as_background) {
        return evaluatedResult.color
      }
    }

    return null
  }

  return { rowColorInfo, evaluateRowColor, getLeftBorderColor, getRowColor, isRowColouringEnabled }
}
