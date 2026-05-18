/**
 * CE stub for expanded form panel composable.
 * EE override at ee/composables/useExpandedFormPanel.ts provides the real implementation.
 */

const [useProvideExpandedFormPanel, useExpandedFormPanel] = useInjectionState(() => {
  const isOpen = ref(false)
  const activeRowId = ref<string | null>(null)
  const activeRowIndex = ref<number | null>(null)
  const activePath = ref<number[]>([])
  const activeRow = ref<Row | null>(null)
  const activeRowState = ref<Record<string, any> | null>(null)
  const isFullscreen = ref(false)
  const panelWidth = ref(420)
  const isLoading = ref(false)
  const isUserNavigating = ref(false)
  const activityExpanded = ref(false)
  const activeActivityTab = ref<'comments' | 'audits'>('comments')

  const hasPrev = computed(() => false)
  const hasNext = computed(() => false)

  const rowNavigator = ref(null)

  const requestSwitch = ref<(_perform: () => void) => void>((_perform) => {})

  const openPanel = (_row: Row, _rowIndex?: number, _state?: Record<string, any>, _rowId?: string, _path?: number[]) => {}
  const closePanel = () => {}
  const setFullscreen = (_val: boolean) => {}
  const navigatePrev = () => {}
  const navigateNext = () => {}
  const navigateToRow = (_index: number) => {}
  const toggleActivity = (_tab?: 'comments' | 'audits') => {}

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
