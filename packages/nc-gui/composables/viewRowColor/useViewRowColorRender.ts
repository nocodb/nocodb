export function useViewRowColorRender() {
  const { activeViewRowColorInfo } = storeToRefs(useViewsStore())

  const isRowColouringEnabled = computed(() => {
    return activeViewRowColorInfo.value && !!activeViewRowColorInfo.value?.mode
  })

  const isCellColouringEnabled = computed(() => {
    return isRowColouringEnabled.value
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
      cellColors: {} as Record<string, any>,
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
    isCellColouringEnabled,
    getEvaluatedRowMetaRowColorInfo,
    getEvaluatedCellColorInfo,
    getCellColorStyle,
    getCellLeftBorderStyle,
  }
}
