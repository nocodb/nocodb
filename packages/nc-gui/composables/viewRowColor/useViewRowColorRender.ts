import { type ColumnType, ROW_COLORING_MODE, type RowColoringInfo, type TableType, type ViewType } from 'nocodb-sdk'
import { validateRowFilters } from '~/utils/dataUtils'

export function useViewRowColorRender(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  rows: Ref<Ref<Record<string, any>>[]>
}) {
  const { $api } = useNuxtApp()
  const baseStore = useBase()
  const { getBaseType } = baseStore

  const rowColorInfo: Ref<RowColoringInfo> = inject(ViewRowColorInj, ref({}))

  const evaluateRowColor = (row: any) => {
    if (rowColorInfo.value && rowColorInfo.value.mode === ROW_COLORING_MODE.SELECT) {
      const selectRowColorInfo = rowColorInfo.value
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
        return obj
      }, {})
  })

  const getLeftBorderColor = (row: any) => {
    if (!row || !evaluatedRowsColor.value) return null
    const evaluatedResult = evaluatedRowsColor.value[getRowHash(row)]
    // if (evaluatedResult?.is_set_as_background === false) {
    //   return evaluatedResult.color
    // }
    return evaluatedResult?.rawColor ?? null
  }

  const getRowColor = (row: any) => {
    if (!row || !evaluatedRowsColor.value) return null
    const evaluatedResult = evaluatedRowsColor.value[getRowHash(row)]
    if (evaluatedResult?.is_set_as_background) {
      return evaluatedResult.color
    }
    return null
  }

  return { rowColorInfo, evaluateRowColor, getLeftBorderColor, getRowColor }
}
