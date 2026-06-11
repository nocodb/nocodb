import type { ColumnType } from 'nocodb-sdk'

const [useProvideExpandedFormPanel, useExpandedFormPanel] = useInjectionState(() => {
  const meta = inject(MetaInj, ref())

  const { isMobileMode } = useGlobal()

  const isOpen = ref(false)
  const activeRowId = ref<string | null>(null)
  const activeRowIndex = ref<number | null>(null)
  // Group path for the currently active row. Empty array = flat (non-group-by)
  // view. For nested groups the path is `[outerIndex, innerIndex, ...]`. The
  // rowNavigator uses this to scope getRow / totalRows / findIndexByRowId to
  // the same group the panel was opened from — without it, prev/next would
  // walk across groups and hasNext would be wrong at group boundaries.
  const activePath = ref<number[]>([])
  const activeRow = ref<Row | null>(null)
  const activeRowState = ref<Record<string, any> | null>(null)
  const isLoading = ref(false)
  const isFullscreen = ref(false)
  const isUserNavigating = ref(false)

  const activityExpanded = ref(false)
  const activeActivityTab = ref<'comments' | 'audits'>('comments')

  const panelWidth = useSidePanelWidth()

  // Navigation callback set by the grid. All methods take an optional `path`
  // (default = []) so the same contract handles both flat and group-by views.
  const rowNavigator = ref<{
    getRow: (index: number, path?: number[]) => { rowId: string; row: Row } | null
    totalRows: (path?: number[]) => number
    // Resolves a rowId to its visible index (or -1 if not in the loaded set, e.g.
    // evicted from the infinite-scroll cache). Used to keep prev/next + canvas
    // active-row indicator in sync when the panel opens without an explicit index
    // (deep-link, page reload, surface switch from modal).
    findIndexByRowId?: (rowId: string, path?: number[]) => number
    // Locates a rowId across every cached group (root + every group-by cache),
    // returning the path it was found under. Used when a deep-link omits
    // `?path=…` (e.g. comment-mention notifications, which don't carry view
    // context) so the panel can still resolve the right group scope for the
    // canvas highlight + prev/next. Returns null when the row isn't loaded
    // anywhere yet (collapsed group, infinite-scroll cache miss).
    findRowLocation?: (rowId: string) => { index: number; path: number[] } | null
  } | null>(null)

  const hasPrev = computed(() => activeRowIndex.value != null && activeRowIndex.value > 0)

  const hasNext = computed(() => {
    if (activeRowIndex.value == null || !rowNavigator.value) return false
    return activeRowIndex.value < rowNavigator.value.totalRows(activePath.value) - 1
  })

  const injectPkIntoRow = (rowData: Record<string, any>, pkId: string) => {
    if (!pkId || !meta.value?.columns) return
    const pkCols = meta.value.columns.filter((c: ColumnType) => c.pk)
    if (!pkCols.length) return

    if (pkCols.length === 1) {
      if (pkCols[0].title && !(pkCols[0].title in rowData)) {
        rowData[pkCols[0].title] = pkId
      }
    } else {
      // Composite PK: rowId format is "val1___val2" with escaped underscores
      const parts = pkId.split(/(?<!\\)___/).map((p) => p.replaceAll('\\_', '_'))
      pkCols.forEach((col, i) => {
        if (col.title && !(col.title in rowData) && i < parts.length) {
          rowData[col.title] = parts[i]
        }
      })
    }
  }

  const openPanel = (row: Row, rowIndex?: number, state?: Record<string, any>, rowId?: string, path: number[] = []) => {
    if (isMobileMode.value) return

    const resolvedRowId = rowId || extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) || null

    if (isOpen.value && resolvedRowId && activeRowId.value === resolvedRowId) return
    if (isOpen.value && !resolvedRowId && rowIndex != null && activeRowIndex.value === rowIndex) return

    const clonedRow = { ...row.row }
    if (resolvedRowId) injectPkIntoRow(clonedRow, resolvedRowId)

    isUserNavigating.value = true
    activeRow.value = { row: clonedRow, oldRow: { ...clonedRow }, rowMeta: { ...row.rowMeta } }
    if (rowIndex != null) activeRowIndex.value = rowIndex
    activePath.value = path
    activeRowState.value = state || null
    isOpen.value = true
    activeRowId.value = resolvedRowId
  }

  const closePanel = () => {
    isOpen.value = false
    activeRow.value = null
    activeRowId.value = null
    activeRowIndex.value = null
    activePath.value = []
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

    const rowInfo = nav.getRow(rowIndex, activePath.value)
    if (!rowInfo) return

    const clonedNavRow = { ...rowInfo.row.row }
    if (rowInfo.rowId) injectPkIntoRow(clonedNavRow, rowInfo.rowId)

    isUserNavigating.value = true
    activeRowId.value = rowInfo.rowId
    activeRowIndex.value = rowIndex
    activeRow.value = { row: clonedNavRow, oldRow: { ...clonedNavRow }, rowMeta: { ...rowInfo.row.rowMeta } }
    activeRowState.value = null
  }

  const navigatePrev = () => {
    if (activeRowIndex.value == null || activeRowIndex.value <= 0) return
    navigateToRow(activeRowIndex.value - 1)
  }

  const navigateNext = () => {
    if (activeRowIndex.value == null || !rowNavigator.value) return
    const total = rowNavigator.value.totalRows(activePath.value)
    if (activeRowIndex.value >= total - 1) return
    navigateToRow(activeRowIndex.value + 1)
  }

  // Grid-driven row switch — the caller passes a closure that performs the
  // actual switch (e.g. expandForm). The panel registers a guarded version
  // that prompts on unsaved edits and defers the closure until the user
  // resolves it. Default invokes the closure immediately so the contract works
  // even before the panel mounts.
  const requestSwitch = ref<(perform: () => void) => void>((perform) => perform())

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
    activePath,
    activeRow,
    activeRowState,
    isFullscreen,
    panelWidth,
    isLoading,
    isUserNavigating,
    activityExpanded,
    activeActivityTab,
    hasPrev,
    hasNext,
    rowNavigator,
    requestSwitch,
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
