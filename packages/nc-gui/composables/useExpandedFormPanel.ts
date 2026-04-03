/**
 * CE stub for expanded form panel composable.
 * EE override at ee/composables/useExpandedFormPanel.ts provides the real implementation.
 */

const [useProvideExpandedFormPanel, useExpandedFormPanel] = useInjectionState(() => {
  const isOpen = ref(false)
  const activeRowId = ref<string | null>(null)
  const activeRowIndex = ref<number | null>(null)
  const isFullscreen = ref(false)
  const panelWidth = ref(420)
  const isLoading = ref(false)
  const activityExpanded = ref(false)
  const activeActivityTab = ref<'comments' | 'audits'>('comments')

  const hasPrev = computed(() => false)
  const hasNext = computed(() => false)
  const activeDisplayValue = computed(() => null)

  const rowNavigator = ref(null)

  const openPanel = (_row: Row, _rowIndex?: number, _state?: Record<string, any>) => {}
  const closePanel = () => {}
  const setFullscreen = (_val: boolean) => {}
  const navigatePrev = () => {}
  const navigateNext = () => {}
  const toggleActivity = (_tab?: 'comments' | 'audits') => {}

  return {
    isOpen,
    activeRowId,
    activeRowIndex,
    isFullscreen,
    panelWidth,
    isLoading,
    activityExpanded,
    activeActivityTab,
    hasPrev,
    hasNext,
    activeDisplayValue,
    rowNavigator,
    openPanel,
    closePanel,
    setFullscreen,
    navigatePrev,
    navigateNext,
    toggleActivity,
  }
}, 'expanded-form-panel-store')

export { useProvideExpandedFormPanel, useExpandedFormPanel }

export function useExpandedFormPanelOrThrow() {
  const store = useExpandedFormPanel()
  if (!store) throw new Error('useExpandedFormPanel must be used within a provider')
  return store
}
