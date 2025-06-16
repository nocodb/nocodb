import { type TableType } from 'nocodb-sdk'

export function useViewRowColorRender(_params: {
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
  const { activeViewRowColorInfo } = storeToRefs(useViewsStore())

  const isRowColouringEnabled = computed(() => {
    return activeViewRowColorInfo.value && !!activeViewRowColorInfo.value?.mode
  })

  const evaluateRowColor = (_row: any) => {
    return null
  }

  const getLeftBorderColor = (_row: any) => {
    return null
  }

  const getRowColor = (_row: any) => {
    return null
  }

  const evaluateRowMetaRowColorInfo = (_row: any) => {
    return {
      is_set_as_background: false,
      rowBgColor: null,
      rowLeftBorderColor: null,
      rowHoverColor: null,
      rowBorderColor: null,
    }
  }
  const getEvaluatedRowMetaRowColorInfo = (_row: any) => {
    return {
      is_set_as_background: false,
      rowBgColor: null,
      rowLeftBorderColor: null,
      rowHoverColor: null,
      rowBorderColor: null,
    }
  }

  return {
    rowColorInfo: activeViewRowColorInfo,
    evaluateRowColor,
    getLeftBorderColor,
    getRowColor,
    isRowColouringEnabled,
    evaluateRowMetaRowColorInfo,
    getEvaluatedRowMetaRowColorInfo,
  }
}
