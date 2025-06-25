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

  return {
    rowColorInfo: activeViewRowColorInfo,
    evaluateRowColor,
    isRowColouringEnabled,
    getEvaluatedRowMetaRowColorInfo,
  }
}
