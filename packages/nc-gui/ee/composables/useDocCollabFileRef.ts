/**
 * Eager FileReference creation for doc-body attachments in collab mode, where the
 * REST save that lazily reconciles FileReferences is skipped. The ref is created
 * at upload time and its id embedded in the editor node, so it rides the Yjs
 * update to peers and persists. Returns null outside collab and for cell-mode /
 * SmartText editors (those still get the id via reconcile on save).
 *
 * `opts` lets Editor.vue pass collabActive/docId explicitly: it provides those
 * injection keys and so can't inject them in its own instance (inject resolves
 * against the parent chain). Descendant node views omit `opts` and inject normally.
 */
export interface DocAttachmentUploadOpts {
  collabActive?: Ref<boolean>
  docId?: Ref<string>
}

export function useDocCollabFileRef(opts?: DocAttachmentUploadOpts) {
  const base = inject(ProjectInj, ref())
  const docId = opts?.docId ?? inject(DocIdInj, ref(''))
  const smartTextCell = inject(SmartTextCellAttachmentInj, ref(null))
  const collabActive = opts?.collabActive ?? inject(DocCollabActiveInj, ref(false))

  const { createFileRef } = useDocumentsStore()

  return async function maybeCreateRef(storedRef: string, fileSize: number): Promise<string | null> {
    const baseId = base.value?.id
    if (!collabActive.value || !docId.value || smartTextCell.value || !baseId) return null
    return createFileRef(baseId, docId.value, storedRef, fileSize)
  }
}
