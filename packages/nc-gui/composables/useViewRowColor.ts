import { type ColumnType, ROW_COLORING_MODE, type RowColoringInfo, type TableType, type ViewType } from 'nocodb-sdk'
import { validateRowFilters } from '~/utils/dataUtils'

export function useViewRowColor(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  view: ViewType
  rowColorInfo?: RowColoringInfo
}) {
  const { $api } = useNuxtApp()
  const baseStore = useBase()
  const { getBaseType } = baseStore

  const rowColorInfoLoaded = ref(false)
  const _rowColorInfo: Ref<RowColoringInfo> = ref(params.rowColorInfo)
  if (params.rowColorInfo) {
    rowColorInfoLoaded.value = true
  }
  const rowColorInfo = computedAsync(async () => {
    if (!rowColorInfoLoaded.value) {
      _rowColorInfo.value = await $api.getViewRowColor(params.view.id)
    }
    return _rowColorInfo.value
  })

  const evaluateRowColor = (row: any) => {
    if (rowColorInfo.value && rowColorInfo.value.mode === ROW_COLORING_MODE.SELECT) {
      const selectRowColorInfo = rowColorInfo.value
      const value = row[selectRowColorInfo.selectColumn.title]
      let color: string | null | undefined = selectRowColorInfo.options.find((k) => k.title === value)?.color
      color = color ? getLighterTint(color) : null

      return color
        ? {
            is_set_as_background: selectRowColorInfo.is_set_as_background,
            color,
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
          }
        }
      }
    }
    return null
  }

  const getLeftBorderColor = (row: any) => {
    const evaluateResult = evaluateRowColor(row)
    if (evaluateResult?.is_set_as_background) {
      return evaluateResult.color
    }
    return null
  }

  const getRowColor = (row: any) => {
    const evaluateResult = evaluateRowColor(row)
    if (evaluateResult?.is_set_as_background === false) {
      return evaluateResult.color
    }
    return null
  }

  return { rowColorInfo, evaluateRowColor, getLeftBorderColor, getRowColor }
}
