import type { ColumnType } from 'nocodb-sdk'
import { isSmartText } from 'nocodb-sdk'
import { useStorage } from '@vueuse/core'

type SmartTextPanelMode = 'floating' | 'fullscreen'

interface SmartTextGetResponse {
  pm: Record<string, any> | null
  markdown: string | null
}

const [useProvideSmartText, useSmartText] = useInjectionState(() => {
  const { $api } = useNuxtApp()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const basesStore = useBases()
  const { activeProjectId } = storeToRefs(basesStore)

  const meta = inject(MetaInj, ref())

  const router = useRouter()
  const route = router.currentRoute

  const isOpen = ref(false)
  const activeRowId = ref<string | null>(null)
  const activeColumnId = ref<string | null>(null)
  const activeRowIndex = ref<number | null>(null)
  const activeRowData = ref<Record<string, any> | null>(null)
  const pmContent = ref<Record<string, any> | null>(null)
  const markdown = ref<string | null>(null)
  const mode = ref<SmartTextPanelMode>('floating')
  const panelWidth = useStorage('nc-smart-text-panel-width', 480)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const isDirty = ref(false)

  // Navigation callback set by the grid — returns { rowId, rowData } or null
  const rowNavigator = ref<{
    getRow: (index: number) => { rowId: string; rowData: Record<string, any> } | null
    totalRows: () => number
  } | null>(null)

  const isFullscreen = computed(() => mode.value === 'fullscreen')

  /**
   * Mirror panel state into the URL so the cell is shareable / restorable.
   * Uses router.replace (not push) — opening / navigating cells should not
   * stack history entries.
   */
  const _syncUrl = () => {
    const next = { ...route.value.query } as Record<string, any>
    if (
      isOpen.value &&
      activeRowId.value &&
      activeColumnId.value
    ) {
      next.smartTextRowId = activeRowId.value
      next.smartTextColId = activeColumnId.value
      if (mode.value === 'fullscreen') {
        next.smartTextMode = 'fullscreen'
      } else {
        delete next.smartTextMode
      }
    } else {
      delete next.smartTextRowId
      delete next.smartTextColId
      delete next.smartTextMode
    }

    // Skip no-op replaces
    const a = JSON.stringify(route.value.query)
    const b = JSON.stringify(next)
    if (a === b) return

    router.replace({ query: next }).catch(() => {})
  }

  const activeColumn = computed<ColumnType | undefined>(() => {
    if (!activeColumnId.value || !meta.value?.columns) return undefined
    return meta.value.columns.find((c) => c.id === activeColumnId.value)
  })

  const smartTextColumns = computed<ColumnType[]>(() => {
    if (!meta.value?.columns) return []
    return meta.value.columns.filter((c) => isSmartText(c))
  })

  const activeDisplayValue = computed(() => {
    if (!activeRowData.value || !meta.value?.columns) return null
    const pvCol = meta.value.columns.find((c) => c.pv)
    if (!pvCol?.title) return null
    const val = activeRowData.value[pvCol.title]
    return val != null && val !== '' ? String(val) : null
  })

  const hasPrev = computed(() => activeRowIndex.value != null && activeRowIndex.value > 0)

  const hasNext = computed(() => {
    if (activeRowIndex.value == null || !rowNavigator.value) return false
    return activeRowIndex.value < rowNavigator.value.totalRows() - 1
  })

  /** Load PM JSON + markdown for the current cell from the backend. */
  const _loadContent = async () => {
    if (
      !activeWorkspaceId.value ||
      !activeProjectId.value ||
      !meta.value?.id ||
      !activeRowId.value ||
      !activeColumnId.value
    )
      return

    isLoading.value = true
    pmContent.value = null
    markdown.value = null

    try {
      const result = (await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'smartTextGetContent',
        tableId: meta.value.id,
        rowId: activeRowId.value,
        columnId: activeColumnId.value,
      })) as SmartTextGetResponse

      pmContent.value = result?.pm ?? null
      markdown.value = result?.markdown ?? null
      isDirty.value = false
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Persist current PM content to the backend. Called on session-end triggers
   * (blur, panel close, row navigation, visibility change, beforeunload).
   * No-op when nothing is dirty.
   */
  const flushSave = async () => {
    if (!isDirty.value || isSaving.value) return
    if (
      !activeWorkspaceId.value ||
      !activeProjectId.value ||
      !meta.value?.id ||
      !activeRowId.value ||
      !activeColumnId.value ||
      !pmContent.value
    )
      return

    isSaving.value = true
    try {
      const result = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'smartTextUpdateContent',
          tableId: meta.value.id,
          rowId: activeRowId.value,
          columnId: activeColumnId.value,
        },
        { pmContent: pmContent.value },
      )) as SmartTextGetResponse

      // Sync derived markdown back into the grid row so the cell preview updates.
      const newMarkdown = result?.markdown ?? null
      markdown.value = newMarkdown
      const colTitle = activeColumn.value?.title
      if (activeRowData.value && colTitle) {
        activeRowData.value[colTitle] = newMarkdown
      }
      isDirty.value = false
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isSaving.value = false
    }
  }

  const setPmContent = (pm: Record<string, any>) => {
    pmContent.value = pm
    isDirty.value = true
  }

  const openEditor = async (
    rowId: string,
    columnId: string,
    rowData?: Record<string, any>,
    rowIndex?: number,
  ) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    // Already showing this exact cell — no-op (avoids reload during re-clicks)
    if (isOpen.value && activeRowId.value === rowId && activeColumnId.value === columnId) {
      return
    }

    // Switching cell while a previous edit is dirty — flush before reload.
    if (isOpen.value && isDirty.value) {
      await flushSave()
    }

    activeRowId.value = rowId
    activeColumnId.value = columnId
    if (rowIndex != null) activeRowIndex.value = rowIndex
    activeRowData.value = rowData || null
    isOpen.value = true
    isDirty.value = false
    _syncUrl()

    await _loadContent()
  }

  const switchField = async (columnId: string) => {
    if (!activeRowId.value) return
    if (isDirty.value) await flushSave()

    activeColumnId.value = columnId
    isDirty.value = false
    _syncUrl()
    await _loadContent()
  }

  /** Navigate to a row by index — flushes save first, then loads new cell. */
  const navigateToRow = async (rowIndex: number) => {
    if (!activeColumnId.value) return
    const nav = rowNavigator.value
    if (!nav) return

    const rowInfo = nav.getRow(rowIndex)
    if (!rowInfo) return

    if (isDirty.value) await flushSave()

    activeRowId.value = rowInfo.rowId
    activeRowIndex.value = rowIndex
    activeRowData.value = rowInfo.rowData
    isDirty.value = false
    _syncUrl()
    await _loadContent()
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

  const closeEditor = async () => {
    if (isDirty.value) await flushSave()

    isOpen.value = false
    activeRowId.value = null
    activeColumnId.value = null
    activeRowIndex.value = null
    activeRowData.value = null
    pmContent.value = null
    markdown.value = null
    isLoading.value = false
    isDirty.value = false
    _syncUrl()
  }

  const setFullscreen = (val: boolean) => {
    mode.value = val ? 'fullscreen' : 'floating'
    _syncUrl()
  }

  return {
    isOpen,
    activeRowId,
    activeColumnId,
    activeRowIndex,
    activeRowData,
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
  }
}, 'smart-text-store')

export { useProvideSmartText, useSmartText }

export function useSmartTextOrThrow() {
  const store = useSmartText()
  if (!store) throw new Error('useSmartText must be used within a provider')
  return store
}
