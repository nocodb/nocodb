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

  // Shared-view (public) context — when present we use the dedicated public
  // endpoint instead of the internal op. Read-only — flushSave is a no-op.
  const isPublic = inject(IsPublicInj, ref(false))
  const sharedViewPassword = inject(SharedViewPasswordInj, ref<string | null>(null))

  const router = useRouter()
  const route = router.currentRoute

  const sharedViewUuid = computed(() => (isPublic.value ? (route.value.params.viewId as string | undefined) ?? null : null))

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
   * Uses dedicated ?cellRow / ?cellCol params so SmartText state is independent
   * of the row-level ?rowId param (used by the expanded-record panel/modal) —
   * opening / closing a cell never affects whether the row panel is showing.
   * Uses router.replace (not push) — opening / navigating cells should not
   * stack history entries.
   */
  const _syncUrl = () => {
    const next = { ...route.value.query } as Record<string, any>
    if (isOpen.value && activeRowId.value && activeColumnId.value) {
      next.cellRow = activeRowId.value
      next.cellCol = activeColumnId.value
      if (mode.value === 'fullscreen') {
        next.cellMode = 'fullscreen'
      } else {
        delete next.cellMode
      }
    } else {
      delete next.cellRow
      delete next.cellCol
      delete next.cellMode
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

  // Last cell key we successfully loaded content for (`${tableId}|${rowId}|${columnId}`).
  // Used as the cache-hit predicate in the deep-link recovery watcher and to
  // discard stale-cell responses when the user switches cells faster than
  // the API resolves (rapid clicks / row navigation).
  const loadedKey = ref<string | null>(null)

  const _cellKey = (tableId: string, rowId: string, columnId: string) => `${tableId}|${rowId}|${columnId}`

  /** Load PM JSON + markdown for the current cell from the backend. */
  const _loadContent = async () => {
    if (!meta.value?.id || !activeRowId.value || !activeColumnId.value) return

    if (isPublic.value) {
      if (!sharedViewUuid.value) return
    } else if (!activeWorkspaceId.value || !activeProjectId.value) {
      return
    }

    // Capture the cell identity at call time. If the user navigates to a
    // different cell while this request is in flight, the captured key will
    // no longer match `activeRowId/activeColumnId` when the response lands —
    // discard it instead of clobbering the new cell's state. Without this
    // guard, an out-of-order response can write cell A's content into cell B's
    // editor, and the next save flushes A's content into B's storage.
    const tableId = meta.value.id
    const rowId = activeRowId.value
    const columnId = activeColumnId.value
    const requestKey = _cellKey(tableId, rowId, columnId)

    isLoading.value = true
    loadedKey.value = null
    pmContent.value = null
    markdown.value = null

    try {
      let result: SmartTextGetResponse

      if (isPublic.value) {
        result = (await $api.public.dataSmartTextRead(
          sharedViewUuid.value!,
          rowId,
          columnId,
          sharedViewPassword.value ? { headers: { 'xc-password': sharedViewPassword.value } } : {},
        )) as unknown as SmartTextGetResponse
      } else {
        result = (await $api.internal.getOperation(activeWorkspaceId.value!, activeProjectId.value!, {
          operation: 'smartTextGetContent',
          tableId,
          rowId,
          columnId,
        })) as SmartTextGetResponse
      }

      // Stale-response guard — only apply if user is still on the same cell.
      const currentKey =
        meta.value?.id && activeRowId.value && activeColumnId.value
          ? _cellKey(meta.value.id, activeRowId.value, activeColumnId.value)
          : null
      if (currentKey !== requestKey) return

      pmContent.value = result?.pm ?? null
      markdown.value = result?.markdown ?? null
      loadedKey.value = requestKey
      isDirty.value = false
    } catch (e: any) {
      // Only surface the error if the user is still on the cell that errored.
      const currentKey =
        meta.value?.id && activeRowId.value && activeColumnId.value
          ? _cellKey(meta.value.id, activeRowId.value, activeColumnId.value)
          : null
      if (currentKey === requestKey) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    } finally {
      // Only release the loading flag for the cell that was loading; if a newer
      // request started, it owns the flag now.
      const currentKey =
        meta.value?.id && activeRowId.value && activeColumnId.value
          ? _cellKey(meta.value.id, activeRowId.value, activeColumnId.value)
          : null
      if (currentKey === requestKey) isLoading.value = false
    }
  }

  // Deep-link recovery — when the panel is opened from a URL on a fresh page
  // load, meta / workspace / project IDs may not be ready yet, so the initial
  // _loadContent call inside openEditor silently early-returns. Re-attempt
  // once the missing prerequisites resolve. Use loadedKey (not "no content as
  // proxy") so genuinely-empty cells aren't re-loaded on unrelated meta changes.
  watch([isOpen, activeRowId, activeColumnId, () => meta.value?.id, activeWorkspaceId, activeProjectId, sharedViewUuid], () => {
    if (!isOpen.value) return
    if (!activeRowId.value || !activeColumnId.value) return
    if (!meta.value?.id) return
    if (isPublic.value) {
      if (!sharedViewUuid.value) return
    } else if (!activeWorkspaceId.value || !activeProjectId.value) {
      return
    }
    const currentKey = _cellKey(meta.value.id, activeRowId.value, activeColumnId.value)
    // Already loaded this exact cell, or load already in flight — skip.
    if (loadedKey.value === currentKey || isLoading.value) return
    _loadContent()
  })

  /**
   * Persist current PM content to the backend. Called on session-end triggers
   * (blur, panel close, row navigation, visibility change, beforeunload).
   * No-op when nothing is dirty.
   */
  const flushSave = async () => {
    // Public shared views are read-only — no save endpoint exists for the
    // public path. Drop any pending dirty state without persisting.
    if (isPublic.value) {
      isDirty.value = false
      return
    }
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

    // Capture cell identity at call time so the post-save markdown sync only
    // writes back into the row data of the cell that was actually saved.
    // Without this, a save flushed mid-navigation would overwrite the new
    // cell's markdown / row data with the old cell's response.
    const tableId = meta.value.id
    const savedRowId = activeRowId.value
    const savedColumnId = activeColumnId.value
    const savedColTitle = activeColumn.value?.title ?? null
    const savedRowData = activeRowData.value
    const requestKey = _cellKey(tableId, savedRowId, savedColumnId)

    isSaving.value = true
    try {
      const result = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'smartTextUpdateContent',
          tableId,
          rowId: savedRowId,
          columnId: savedColumnId,
        },
        { pmContent: pmContent.value },
      )) as SmartTextGetResponse

      // Always update the saved cell's row data in place — it remains
      // referenced by the grid even after the user navigates away.
      const newMarkdown = result?.markdown ?? null
      if (savedRowData && savedColTitle) {
        savedRowData[savedColTitle] = newMarkdown
      }

      // Only sync the panel-visible refs (markdown, isDirty) when the user
      // is still on the cell that was saved.
      const currentKey =
        meta.value?.id && activeRowId.value && activeColumnId.value
          ? _cellKey(meta.value.id, activeRowId.value, activeColumnId.value)
          : null
      if (currentKey === requestKey) {
        markdown.value = newMarkdown
        isDirty.value = false
      }
    } catch (e: any) {
      const currentKey =
        meta.value?.id && activeRowId.value && activeColumnId.value
          ? _cellKey(meta.value.id, activeRowId.value, activeColumnId.value)
          : null
      if (currentKey === requestKey) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    } finally {
      isSaving.value = false
    }
  }

  const setPmContent = (pm: Record<string, any>) => {
    pmContent.value = pm
    isDirty.value = true
  }

  const openEditor = async (rowId: string, columnId: string, rowData?: Record<string, any>, rowIndex?: number) => {
    if (isPublic.value) {
      if (!sharedViewUuid.value) return
    } else if (!activeWorkspaceId.value || !activeProjectId.value) {
      return
    }

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

  /**
   * Backfill row context (index + data) after the panel has been opened from a
   * URL — at deep-link time the row may not yet be in the grid's cached rows,
   * which leaves chevron navigation and cell highlight non-functional. The
   * grid calls this once the row arrives in cache.
   */
  const setRowContext = (rowIndex: number, rowData: Record<string, any>) => {
    if (activeRowIndex.value !== rowIndex) activeRowIndex.value = rowIndex
    if (activeRowData.value !== rowData) activeRowData.value = rowData
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
    loadedKey.value = null
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
    setRowContext,
  }
}, 'smart-text-store')

export { useProvideSmartText, useSmartText }

export function useSmartTextOrThrow() {
  const store = useSmartText()
  if (!store) throw new Error('useSmartText must be used within a provider')
  return store
}
