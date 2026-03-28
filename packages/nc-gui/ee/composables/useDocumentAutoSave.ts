import type { Editor } from '@tiptap/vue-3'
import type { DocumentType } from 'nocodb-sdk'

/**
 * Encapsulates auto-save logic for the document editor:
 * - Debounced save (2s after last edit)
 * - Content loading with optimistic concurrency
 * - Flush-on-unmount to prevent data loss
 * - Guard against saving during programmatic setContent
 */
export function useDocumentAutoSave({
  editor,
  activeProjectId,
  isEditable,
}: {
  editor: Ref<Editor | undefined>
  activeProjectId: Ref<string | undefined>
  isEditable: Ref<boolean>
}) {
  const documentsStore = useDocumentsStore()
  const { loadDocument, updateDocument } = documentsStore
  const { activeDocument } = storeToRefs(documentsStore)

  const doc = ref<DocumentType | null>(null)
  const title = ref('')
  const lastSavedTitle = ref('')
  const isSaving = ref(false)
  const isLoaded = ref(false)
  const saveTimeout = ref<NodeJS.Timeout>()

  // Guard: suppress onUpdate saves while we're programmatically loading content
  // into the editor (setContent triggers onUpdate, which would queue a no-op save).
  const isSettingContent = ref(false)

  // Track whether a user edit has occurred since the last load/save.
  // Used to allow saving empty documents when the user intentionally clears content.
  const hasUserEdited = ref(false)

  // Monotonically increasing ID to discard stale loadAndSetDoc results
  let loadSequence = 0

  // Flag to re-queue save when a save is already in-flight
  let pendingSaveAfterCurrent = false

  const { user } = useGlobal()

  // When the store version advances due to current user's action (e.g. sidebar rename),
  // sync local doc fields so the stale banner doesn't appear for your own changes.
  // Watches both version AND isSaving so that version bumps that arrive during an
  // in-flight save are re-evaluated once the save settles (Vue watchers only fire on
  // value change — without isSaving in the source, a version bump skipped during save
  // would never be re-processed).
  watch(
    () => [activeDocument.value?.version, isSaving.value] as const,
    ([storeVersion]) => {
      if (!doc.value || !activeDocument.value || !isLoaded.value || isSaving.value) return
      // Guard: only sync if activeDocument matches the editor's local doc
      if (activeDocument.value.id !== doc.value.id) return
      if (!storeVersion || storeVersion <= (doc.value.version ?? 0)) return
      if (activeDocument.value.updated_by !== user.value?.id) return

      // If the user hasn't made unsaved edits and the version jumped by more than
      // what a sidebar-only change would produce, auto-reload content. This handles
      // cases where the current user's own external action (e.g. chat tool) modified
      // content — the editor's save() wasn't involved, so content is stale.
      if (!hasUserEdited.value && !saveTimeout.value) {
        reloadDocument()
        return
      }

      doc.value.version = storeVersion
      doc.value.updated_at = activeDocument.value.updated_at
      doc.value.updated_by = activeDocument.value.updated_by
      if (activeDocument.value.title && activeDocument.value.title !== doc.value.title) {
        doc.value.title = activeDocument.value.title
        title.value = activeDocument.value.title
        lastSavedTitle.value = activeDocument.value.title
      }
      if (activeDocument.value.meta !== undefined) {
        doc.value.meta = activeDocument.value.meta
      }
    },
  )

  /** Whether the document is stale (another user saved a newer version). */
  const isStale = computed(() => {
    if (!doc.value || !activeDocument.value) return false
    if (!isLoaded.value || isSaving.value) return false

    // During navigation, activeDocument switches to the new page before
    // loadAndSetDoc flushes the old page's pending save. Without this guard,
    // comparing versions across different documents would false-positive as
    // stale, causing the flush save to be skipped and edits to be lost.
    if (activeDocument.value.id !== doc.value.id) return false

    // Only stale if store version is ahead (another user saved)
    return (activeDocument.value.version ?? 0) > (doc.value.version ?? 0)
  })

  /** The user ID of who made the remote change (for banner text). */
  const staleUpdatedBy = computed(() => {
    if (!isStale.value) return undefined
    return activeDocument.value?.updated_by
  })

  /** Persist current editor state + title to the backend. */
  const save = async () => {
    if (isStale.value) return
    if (!isEditable.value) return
    if (!doc.value || !activeProjectId.value || !editor.value) return

    // Prevent concurrent saves — re-queue if one is already in-flight
    if (isSaving.value) {
      pendingSaveAfterCurrent = true
      return
    }

    isSaving.value = true
    try {
      const content = editor.value.getJSON()

      // Guard: skip saving if editor state is empty AND the title hasn't changed
      // AND no user edit has occurred. This prevents data loss from transient editor
      // state corruption (e.g. paste bugs) while still allowing intentional clears
      // and title-only saves on pages with empty bodies.
      const nodeCount = content?.content?.length ?? 0
      const firstType = content?.content?.[0]?.type
      const isEmptyDoc = nodeCount <= 1 && firstType === 'paragraph' && !content?.content?.[0]?.content
      const effectiveTitle = title.value || 'Untitled'
      const titleChanged = effectiveTitle !== lastSavedTitle.value
      if (isEmptyDoc && !titleChanged && !hasUserEdited.value) {
        isSaving.value = false
        return
      }

      // Capture doc ID before the async call — if the user navigates during
      // updateDocument, doc.value will point to the NEW document. Writing
      // the old save's response version onto it would corrupt the new doc's
      // version and cause 422 failures on subsequent saves.
      const savingDocId = doc.value.id!

      const updated = await updateDocument(activeProjectId.value, savingDocId, {
        title: effectiveTitle,
        content,
        version: doc.value.version,
      })

      // Only write back if we're still on the same document
      if (updated && doc.value?.id === savingDocId) {
        doc.value.version = updated.version
        doc.value.updated_at = updated.updated_at
        doc.value.updated_by = updated.updated_by
        lastSavedTitle.value = effectiveTitle
        hasUserEdited.value = false
      }
    } catch (_e) {
      // Error already surfaced by store's updateDocument via message.error
    } finally {
      isSaving.value = false
      // If another save was requested while we were saving, run it now
      if (pendingSaveAfterCurrent) {
        pendingSaveAfterCurrent = false
        save()
      }
    }
  }

  const debouncedSave = () => {
    // Skip saves triggered by programmatic setContent during page load
    if (isSettingContent.value) return

    // Skip saves before the document is fully loaded. isLoaded is false
    // throughout loadAndSetDoc (from start until after setContent + nextTick)
    // so this catches any deferred ProseMirror transactions (e.g. extension
    // appendTransaction, DOM mutation observers) that fire onUpdate after
    // isSettingContent is already reset.
    if (!isLoaded.value) return

    hasUserEdited.value = true

    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value)
    }
    saveTimeout.value = setTimeout(save, 2000)
  }

  /**
   * Wait for the Tiptap editor to be available.
   * `useEditor` creates the Editor instance inside `onMounted`, so
   * `editor.value` is `undefined` during setup and the first immediate
   * watch execution. This helper polls via `nextTick` until the editor
   * exists (typically resolves after the first mount tick).
   */
  const waitForEditor = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (editor.value) return resolve()

      let unwatch: (() => void) | undefined

      const timeout = setTimeout(() => {
        unwatch?.()
        reject(new Error('Editor failed to initialize within 5 seconds'))
      }, 5000)

      unwatch = watch(editor, (val) => {
        if (val) {
          clearTimeout(timeout)
          unwatch?.()
          resolve()
        }
      })
    })
  }

  /**
   * Parse content from the API response into a Tiptap-compatible JSON object.
   * The backend should return parsed JSON, but we defensively handle string
   * values in case of cache inconsistencies.
   */
  const parseContent = (content: unknown): Record<string, any> | null => {
    if (!content) return null
    if (typeof content === 'object') return content as Record<string, any>
    if (typeof content === 'string') {
      try {
        return JSON.parse(content)
      } catch {
        return null
      }
    }
    return null
  }

  const loadAndSetDoc = async (id: string) => {
    // Flush any pending save for the *previous* page before switching
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value)
      await save()
    }

    const thisLoad = ++loadSequence

    isLoaded.value = false
    hasUserEdited.value = false
    const loaded = await loadDocument(id)

    // Discard stale result — user navigated away before load completed
    if (thisLoad !== loadSequence) return

    if (loaded) {
      doc.value = loaded
      // Treat "Untitled" as empty — it's the server default, not a user-provided name
      title.value = loaded.title === 'Untitled' ? '' : loaded.title || ''
      lastSavedTitle.value = loaded.title || 'Untitled'

      const parsed = parseContent(loaded.content)
      if (parsed) {
        // useEditor creates the instance in onMounted — wait for it on first load
        await waitForEditor()

        // Discard if navigated away during editor wait
        if (thisLoad !== loadSequence) return

        // Suppress onUpdate → debouncedSave while loading content programmatically
        isSettingContent.value = true
        editor.value!.commands.setContent(parsed)

        // Wait a tick for ProseMirror to finish its transaction cycle
        // before re-enabling user-edit saves
        await nextTick()
        isSettingContent.value = false
      }
    }
    isLoaded.value = true
  }

  /** Reload the document from the server, clearing stale state. */
  async function reloadDocument() {
    if (!doc.value?.id) return
    // Cancel any pending save — stale content shouldn't overwrite newer version
    if (saveTimeout.value) clearTimeout(saveTimeout.value)
    pendingSaveAfterCurrent = false

    // Wait for any in-flight save to settle before loading. Without this,
    // the save's success handler could write a stale version onto the freshly
    // loaded doc.value, causing the next save to fail with a 422.
    if (isSaving.value) {
      await until(isSaving).toBe(false, { timeout: 10000 })
    }

    hasUserEdited.value = false
    await loadAndSetDoc(doc.value.id)
  }

  /**
   * Flush pending save on unmount. Captures content synchronously BEFORE
   * destroy() tears down ProseMirror, then fires the async save with the
   * captured snapshot.
   */
  const flushOnUnmount = () => {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value)
      // Skip if stale (another user saved a newer version — our version will be
      // rejected by the backend anyway), or if a save is already in-flight.
      if (!isSaving.value && !isStale.value && isEditable.value && doc.value && activeProjectId.value && editor.value) {
        const content = editor.value.getJSON()
        const docId = doc.value.id!
        const version = doc.value.version
        const docTitle = title.value || 'Untitled'
        const baseId = activeProjectId.value

        // Guard: skip saving empty doc on unmount unless title changed or user edited
        const nodeCount = content?.content?.length ?? 0
        const firstType = content?.content?.[0]?.type
        const isEmptyDoc = nodeCount <= 1 && firstType === 'paragraph' && !content?.content?.[0]?.content
        const titleChanged = docTitle !== lastSavedTitle.value
        if (!(isEmptyDoc && !titleChanged && !hasUserEdited.value)) {
          // Fire-and-forget is acceptable here — content is already captured
          updateDocument(baseId, docId, { title: docTitle, content, version })
        }
      }
    }
  }

  return {
    doc,
    title,
    lastSavedTitle,
    isSaving,
    isLoaded,
    isSettingContent,
    isStale,
    staleUpdatedBy,
    save,
    debouncedSave,
    loadAndSetDoc,
    reloadDocument,
    flushOnUnmount,
    activeDocument,
  }
}
