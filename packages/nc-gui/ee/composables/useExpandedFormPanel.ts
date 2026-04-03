import { useStorage } from '@vueuse/core'
import type { ColumnType } from 'nocodb-sdk'

const [useProvideExpandedFormPanel, useExpandedFormPanel] = useInjectionState(() => {
  const meta = inject(MetaInj, ref())

  const { isMobileMode } = useGlobal()


  const isOpen = ref(false)
  const activeRowId = ref<string | null>(null)
  const activeRowIndex = ref<number | null>(null)
  const activeRow = ref<Row | null>(null)
  const activeRowState = ref<Record<string, any> | null>(null)
  const isLoading = ref(false)
  const isFullscreen = ref(false)

  const activityExpanded = ref(false)
  const activeActivityTab = ref<'comments' | 'audits'>('comments')

  const panelWidth = useStorage('nc-expanded-form-panel-width', 420)

  // Navigation callback set by the grid
  const rowNavigator = ref<{
    getRow: (index: number) => { rowId: string; row: Row } | null
    totalRows: () => number
  } | null>(null)

  const hasPrev = computed(() => activeRowIndex.value != null && activeRowIndex.value > 0)

  const hasNext = computed(() => {
    if (activeRowIndex.value == null || !rowNavigator.value) return false
    return activeRowIndex.value < rowNavigator.value.totalRows() - 1
  })

  const openPanel = (row: Row, rowIndex?: number, state?: Record<string, any>, rowId?: string) => {
    if (isMobileMode.value) return

    const resolvedRowId = rowId || extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) || null

    if (isOpen.value && resolvedRowId && activeRowId.value === resolvedRowId) return
    if (isOpen.value && !resolvedRowId && rowIndex != null && activeRowIndex.value === rowIndex) return

    activeRow.value = { row: { ...row.row }, oldRow: { ...row.row }, rowMeta: { ...row.rowMeta } }
    if (rowIndex != null) activeRowIndex.value = rowIndex
    activeRowState.value = state || null
    isOpen.value = true
    activeRowId.value = resolvedRowId
  }

  const closePanel = () => {
    isOpen.value = false
    activeRow.value = null
    activeRowId.value = null
    activeRowIndex.value = null
    activeRowState.value = null
    isLoading.value = false
    activityExpanded.value = false

    if (isFullscreen.value) {
      isFullscreen.value = false
    }
  }

  const navigateToRow = (rowIndex: number) => {
    const nav = rowNavigator.value
    if (!nav) return

    const rowInfo = nav.getRow(rowIndex)
    if (!rowInfo) return

    activeRowId.value = rowInfo.rowId
    activeRowIndex.value = rowIndex
    activeRow.value = { row: { ...rowInfo.row.row }, oldRow: { ...rowInfo.row.row }, rowMeta: { ...rowInfo.row.rowMeta } }
    activeRowState.value = null
  }

  const navigatePrev = () => {
    if (activeRowIndex.value == null || activeRowIndex.value <= 0) return
    navigateToRow(activeRowIndex.value - 1)
  }

  const navigateNext = () => {
    if (activeRowIndex.value == null || !rowNavigator.value) return
    const total = rowNavigator.value.totalRows()
    if (activeRowIndex.value >= total - 1) return
    navigateToRow(activeRowIndex.value + 1)
  }

  const setFullscreen = (val: boolean) => {
    isFullscreen.value = val
  }

  const toggleActivity = (tab?: 'comments' | 'audits') => {
    if (tab) {
      activeActivityTab.value = tab
      activityExpanded.value = true
    } else {
      activityExpanded.value = !activityExpanded.value
    }
  }

  return {
    isOpen,
    activeRowId,
    activeRowIndex,
    activeRow,
    activeRowState,
    isFullscreen,
    panelWidth,
    isLoading,
    activityExpanded,
    activeActivityTab,
    hasPrev,
    hasNext,
    rowNavigator,
    openPanel,
    closePanel,
    setFullscreen,
    navigatePrev,
    navigateNext,
    navigateToRow,
    toggleActivity,
  }
}, 'expanded-form-panel-store')

export { useProvideExpandedFormPanel, useExpandedFormPanel }

export function useExpandedFormPanelOrThrow() {
  const store = useExpandedFormPanel()
  if (!store) throw new Error('useExpandedFormPanel must be used within a provider')
  return store
}
