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

  const { user } = useGlobal()

  // When the store version advances due to current user's action (e.g. sidebar rename),
  // sync local doc fields so the stale banner doesn't appear for your own changes.
  watch(
    () => activeDocument.value?.version,
    (storeVersion) => {
      if (!doc.value || !activeDocument.value || !isLoaded.value || isSaving.value) return
      if (!storeVersion || storeVersion <= (doc.value.version ?? 0)) return
      if (activeDocument.value.updated_by !== user.value?.id) return

      doc.value.version = storeVersion
      doc.value.updated_at = activeDocument.value.updated_at
      doc.value.updated_by = activeDocument.value.updated_by
      if (activeDocument.value.title) {
        title.value = activeDocument.value.title
        lastSavedTitle.value = activeDocument.value.title
      }
    },
  )

  /** Whether the document is stale (another user saved a newer version). */
  const isStale = computed(() => {
    if (!doc.value || !activeDocument.value) return false
    if (!isLoaded.value || isSaving.value) return false

    // Only stale if store version is ahead (another user saved)
    return (activeDocument.value.version ?? 0) > (doc.value.version ?? 0)
  })

  /** The user ID of who made the remote change (for banner text). */
  const staleUpdatedBy = computed(() => {
    if (!isStale.value) return undefined
    return activeDocument.value?.updated_by
  })

  /** Reload the document from the server, clearing stale state. */
  const reloadDocument = async () => {
    if (!doc.value?.id) return
    // Cancel any pending save — stale content shouldn't overwrite newer version
    if (saveTimeout.value) clearTimeout(saveTimeout.value)
    hasUserEdited.value = false
    await loadAndSetDoc(doc.value.id)
  }

  /** Persist current editor state + title to the backend. */
  const save = async () => {
    if (isStale.value) return
    if (!isEditable.value) return
    if (!doc.value || !activeProjectId.value || !editor.value) return

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

      const updated = await updateDocument(activeProjectId.value, doc.value.id!, {
        title: effectiveTitle,
        content,
        version: doc.value.version,
      })

      // Advance local doc fields to match server response
      if (updated) {
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
    }
  }

  const debouncedSave = () => {
    // Skip saves triggered by programmatic setContent during page load
    if (isSettingContent.value) return

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

    isLoaded.value = false
    hasUserEdited.value = false
    const loaded = await loadDocument(id)

    if (loaded) {
      doc.value = loaded
      // Treat "Untitled" as empty — it's the server default, not a user-provided name
      title.value = loaded.title === 'Untitled' ? '' : loaded.title || ''
      lastSavedTitle.value = loaded.title || 'Untitled'

      const parsed = parseContent(loaded.content)
      if (parsed) {
        // useEditor creates the instance in onMounted — wait for it on first load
        await waitForEditor()

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

  /**
   * Flush pending save on unmount. Captures content synchronously BEFORE
   * destroy() tears down ProseMirror, then fires the async save with the
   * captured snapshot.
   */
  const flushOnUnmount = () => {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value)
      if (isEditable.value && doc.value && activeProjectId.value && editor.value) {
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
