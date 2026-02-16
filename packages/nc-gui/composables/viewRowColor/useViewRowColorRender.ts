export function useViewRowColorRender() {
  const { activeViewRowColorInfo } = storeToRefs(useViewsStore())

  const isRowColouringEnabled = computed(() => {
    return activeViewRowColorInfo.value && !!activeViewRowColorInfo.value?.mode
  })

  const evaluateRowColor = (_row: any) => {
    return null
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

  const getEvaluatedCellColorInfo = (_row: any, _columnId: string) => {
    return {
      is_set_as_background: false,
      cellBgColor: null as string | null,
      cellBorderColor: null as string | null,
      cellHoverColor: null as string | null,
      cellLeftBorderColor: null as string | null,
    }
  }

  return {
    rowColorInfo: activeViewRowColorInfo,
    evaluateRowColor,
    isRowColouringEnabled,
    getEvaluatedRowMetaRowColorInfo,
    getEvaluatedCellColorInfo,
  }
}
