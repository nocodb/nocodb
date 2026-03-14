import type { ColumnType, DocumentType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { useStorage } from '@vueuse/core'

type DocFieldPanelMode = 'floating' | 'pinned' | 'fullscreen'

const [useProvideDocField, useDocField] = useInjectionState(() => {
  const { $api } = useNuxtApp()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const basesStore = useBases()
  const { activeProjectId } = storeToRefs(basesStore)

  const meta = inject(MetaInj, ref())

  const isOpen = ref(false)
  const activeRowId = ref<string | null>(null)
  const activeColumnId = ref<string | null>(null)
  const docId = ref<string | null>(null)
  const mode = ref<DocFieldPanelMode>('floating')
  const panelWidth = useStorage('nc-doc-field-panel-width', 480)
  const isSaving = ref(false)

  const isLoading = ref(false)

  const isPinned = computed(() => mode.value === 'pinned')
  const isFullscreen = computed(() => mode.value === 'fullscreen')

  const activeColumn = computed<ColumnType | undefined>(() => {
    if (!activeColumnId.value || !meta.value?.columns) return undefined
    return meta.value.columns.find((c) => c.id === activeColumnId.value)
  })

  const docColumns = computed<ColumnType[]>(() => {
    if (!meta.value?.columns) return []
    return meta.value.columns.filter((c) => c.uidt === UITypes.Doc)
  })

  const openDoc = async (rowId: string, columnId: string, rowData?: Record<string, any>) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    // Already showing this exact doc — just focus the panel
    if (isOpen.value && activeRowId.value === rowId && activeColumnId.value === columnId && docId.value) {
      return
    }

    activeRowId.value = rowId
    activeColumnId.value = columnId
    isOpen.value = true
    isLoading.value = true
    docId.value = null

    try {
      const doc = (await $api.internal.postOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'docFieldGetOrCreate',
        columnId,
        rowId,
      })) as DocumentType

      docId.value = doc.id ?? null

      // Optimistically update row data so grid cell reflects doc existence
      if (doc.id && rowData && activeColumn.value?.title) {
        rowData[activeColumn.value.title] = { id: doc.id, title: doc.title || 'Untitled' }
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      closeDoc()
    } finally {
      isLoading.value = false
    }
  }

  const closeDoc = () => {
    isOpen.value = false
    activeRowId.value = null
    activeColumnId.value = null
    docId.value = null
    isLoading.value = false

    if (mode.value === 'fullscreen') {
      mode.value = 'floating'
    }
  }

  const deleteDoc = async (columnId: string, rowId: string, rowData?: Record<string, any>) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      await $api.internal.postOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'docFieldDelete',
        columnId,
        rowId,
      })

      // Optimistically clear row data
      if (rowData) {
        const col = meta.value?.columns?.find((c) => c.id === columnId)
        if (col?.title) {
          rowData[col.title] = null
        }
      }

      // Close panel if this doc was open
      if (activeColumnId.value === columnId && activeRowId.value === rowId) {
        closeDoc()
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const switchField = (columnId: string) => {
    if (!activeRowId.value) return
    openDoc(activeRowId.value, columnId)
  }

  const togglePin = () => {
    if (mode.value === 'fullscreen') return
    mode.value = mode.value === 'pinned' ? 'floating' : 'pinned'
  }

  const setFullscreen = (val: boolean) => {
    mode.value = val ? 'fullscreen' : 'floating'
  }

  return {
    isOpen,
    activeRowId,
    activeColumnId,
    docId,
    mode,
    panelWidth,
    isSaving,
    isLoading,
    isPinned,
    isFullscreen,
    activeColumn,
    docColumns,
    openDoc,
    closeDoc,
    deleteDoc,
    switchField,
    togglePin,
    setFullscreen,
  }
}, 'doc-field-store')

export { useProvideDocField, useDocField }

export function useDocFieldOrThrow() {
  const store = useDocField()
  if (!store) throw new Error('useDocField must be used within a provider')
  return store
}
