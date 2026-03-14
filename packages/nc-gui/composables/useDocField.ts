/**
 * CE stub for Doc field panel composable.
 * EE override at ee/composables/useDocField.ts provides the real implementation.
 */

type DocFieldPanelMode = 'floating' | 'pinned' | 'fullscreen'

const [useProvideDocField, useDocField] = useInjectionState(() => {
  const isOpen = ref(false)
  const activeRowId = ref<string | null>(null)
  const activeColumnId = ref<string | null>(null)
  const activeRowIndex = ref<number | null>(null)
  const docId = ref<string | null>(null)
  const mode = ref<DocFieldPanelMode>('floating')
  const panelWidth = ref(480)
  const isSaving = ref(false)

  const isLoading = ref(false)

  const isPinned = computed(() => mode.value === 'pinned')
  const isFullscreen = computed(() => mode.value === 'fullscreen')

  const activeColumn = computed(() => undefined)
  const docColumns = computed(() => [])
  const hasPrev = computed(() => false)
  const hasNext = computed(() => false)

  const rowNavigator = ref(null)

  const openDoc = async (_rowId: string, _columnId: string, _rowData?: Record<string, any>, _rowIndex?: number) => {}
  const closeDoc = () => {}
  const deleteDoc = async (_columnId: string, _rowId: string, _rowData?: Record<string, any>) => {}
  const switchField = (_columnId: string) => {}
  const togglePin = () => {}
  const setFullscreen = (_val: boolean) => {}
  const navigatePrev = () => {}
  const navigateNext = () => {}
  const createDocForCurrentRow = async () => {}

  return {
    isOpen,
    activeRowId,
    activeColumnId,
    activeRowIndex,
    docId,
    mode,
    panelWidth,
    isSaving,
    isLoading,
    isPinned,
    isFullscreen,
    activeColumn,
    docColumns,
    hasPrev,
    hasNext,
    rowNavigator,
    openDoc,
    closeDoc,
    deleteDoc,
    switchField,
    togglePin,
    setFullscreen,
    navigatePrev,
    navigateNext,
    createDocForCurrentRow,
  }
}, 'doc-field-store')

export { useProvideDocField, useDocField }

export function useDocFieldOrThrow() {
  const store = useDocField()
  if (!store) throw new Error('useDocField must be used within a provider')
  return store
}
