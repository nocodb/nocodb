/**
 * CE stub for SmartText panel composable.
 * EE override at ee/composables/useSmartText.ts provides the real implementation.
 */

type SmartTextPanelMode = 'floating' | 'fullscreen'

const [useProvideSmartText, useSmartText] = useInjectionState(() => {
  const isOpen = ref(false)
  const activeRowId = ref<string | null>(null)
  const activeColumnId = ref<string | null>(null)
  const activeRowIndex = ref<number | null>(null)
  const pmContent = ref<Record<string, any> | null>(null)
  const markdown = ref<string | null>(null)
  const mode = ref<SmartTextPanelMode>('floating')
  const panelWidth = ref(480)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const isDirty = ref(false)

  const isFullscreen = computed(() => mode.value === 'fullscreen')

  const activeColumn = computed(() => undefined)
  const smartTextColumns = computed(() => [])
  const activeDisplayValue = computed<string | null>(() => null)
  const hasPrev = computed(() => false)
  const hasNext = computed(() => false)

  const rowNavigator = ref(null)

  const openEditor = async (
    _rowId: string,
    _columnId: string,
    _rowData?: Record<string, any>,
    _rowIndex?: number,
  ) => {}
  const closeEditor = async () => {}
  const flushSave = async () => {}
  const setPmContent = (_pm: Record<string, any>) => {}
  const switchField = (_columnId: string) => {}
  const setFullscreen = (_val: boolean) => {}
  const navigatePrev = () => {}
  const navigateNext = () => {}
  const setRowContext = (_rowIndex: number, _rowData: Record<string, any>) => {}

  return {
    isOpen,
    activeRowId,
    activeColumnId,
    activeRowIndex,
    pmContent,
    markdown,
    mode,
    panelWidth,
    isLoading,
    isSaving,
    isDirty,
    isFullscreen,
    activeColumn,
    smartTextColumns,
    activeDisplayValue,
    hasPrev,
    hasNext,
    rowNavigator,
    openEditor,
    closeEditor,
    flushSave,
    setPmContent,
    switchField,
    setFullscreen,
    navigatePrev,
    navigateNext,
    setRowContext,
  }
}, 'smart-text-store')

export { useProvideSmartText, useSmartText }

export function useSmartTextOrThrow() {
  const store = useSmartText()
  if (!store) throw new Error('useSmartText must be used within a provider')
  return store
}
