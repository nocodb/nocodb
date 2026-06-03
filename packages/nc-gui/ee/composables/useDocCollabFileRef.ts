/**
 * Eager FileReference creation for doc-body attachments while a live Yjs session
 * owns the body. In collab mode the REST save that lazily reconciles
 * FileReferences is skipped, so the ref is created at upload time and its id
 * embedded in the editor node — it then rides the Yjs update to peers and
 * persists. Returns null outside collab (the id is injected later by
 * reconcileFileReferences on save) and for cell-mode/SmartText editors.
 */
export function useDocCollabFileRef() {
  const base = inject(ProjectInj, ref())
  const docId = inject(DocIdInj, ref(''))
  const smartTextCell = inject(SmartTextCellAttachmentInj, ref(null))
  const collabActive = inject(DocCollabActiveInj, ref(false))

  const { createFileRef } = useDocumentsStore()

  return async function maybeCreateRef(storedRef: string, fileSize: number): Promise<string | null> {
    const docIdVal = docId?.value
    if (!collabActive.value || !docIdVal || smartTextCell?.value || !base?.value?.id) return null
    return createFileRef(base.value.id, docIdVal, storedRef, fileSize)
  }
}
