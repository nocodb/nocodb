/**
 * Composable for uploading file attachments in the document editor.
 *
 * Similar to useDocumentImageUpload but handles any file type:
 * - Opens a native file picker (no accept filter)
 * - Uploads via NocoDB's storage API to noco/docs path
 * - Inserts a fileAttachment node with instant blob reference,
 *   then swaps to permanent path once uploaded
 */
import type { Editor } from '@tiptap/core'
import type { DocAttachmentUploadOpts } from './useDocCollabFileRef'

export function useDocumentFileUpload(opts?: DocAttachmentUploadOpts) {
  const { batchUploadFiles } = useAttachment()

  const maybeCreateRef = useDocCollabFileRef(opts)

  const { t } = useI18n()

  const uploadCount = ref(0)
  const isUploading = computed(() => uploadCount.value > 0)

  /** Open native file picker for any file type. Returns selected files (supports multiple). */
  function openFilePicker(options?: { multiple?: boolean }): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      if (options?.multiple) input.multiple = true
      input.style.display = 'none'
      input.addEventListener('change', () => {
        const files = Array.from(input.files || [])
        input.remove()
        resolve(files)
      })
      input.addEventListener('cancel', () => {
        input.remove()
        resolve([])
      })
      document.body.appendChild(input)
      input.click()
    })
  }

  /**
   * Upload a file and insert a fileAttachment node into the editor.
   *
   * If `existingBlobUrl` is provided, skip node insertion (already inserted)
   * and only perform the upload + attr swap.
   */
  async function uploadAndInsert(editor: Editor, file: File, existingBlobUrl?: string) {
    const blobUrl = existingBlobUrl || URL.createObjectURL(file)

    if (!existingBlobUrl) {
      // Insert placeholder node with file metadata
      editor
        .chain()
        .focus()
        .insertFileAttachment({
          src: blobUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        })
        .run()
    }

    uploadCount.value++
    try {
      const uploaded = await batchUploadFiles([file], 'noco/docs')

      if (uploaded.length) {
        const att = uploaded[0]
        const storedRef = att.path || att.url
        if (storedRef) {
          // Retry transient ref-creation failures (offline blip / 5xx). A null ref
          // leaves the node with only `path`, which can't render once the blob URL
          // is revoked — and the REST reconcile that used to backfill the id is
          // blocked while the doc is live. Surface a clear error on persistent
          // failure instead of silently producing a broken attachment.
          let fileRefId = await maybeCreateRef(storedRef, file.size)
          for (let attempt = 1; !fileRefId && attempt <= 2; attempt++) {
            await new Promise((r) => setTimeout(r, 300 * attempt))
            fileRefId = await maybeCreateRef(storedRef, file.size)
          }
          if (!fileRefId) {
            message.error(t('msg.error.docAttachmentRefFailed'))
          }
          updateFileNode(editor, blobUrl, fileRefId ? { path: storedRef, id: fileRefId } : { path: storedRef })
        } else {
          removeFileNode(editor, blobUrl)
        }
      } else {
        removeFileNode(editor, blobUrl)
      }
    } catch {
      removeFileNode(editor, blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
      uploadCount.value--
    }
  }

  /** Walk the doc tree to find a fileAttachment node by src and update its attributes. */
  function updateFileNode(editor: Editor, matchSrc: string, newAttrs: Record<string, any>) {
    // Read fresh state to avoid stale positions from concurrent uploads
    const { doc, tr } = editor.view.state
    doc.descendants((node, pos) => {
      if (node.type.name === 'fileAttachment' && node.attrs.src === matchSrc) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...newAttrs })
        return false
      }
    })
    if (tr.docChanged) editor.view.dispatch(tr)
  }

  /** Walk the doc tree to find and delete a fileAttachment node by src. */
  function removeFileNode(editor: Editor, matchSrc: string) {
    const { doc, tr } = editor.view.state
    doc.descendants((node, pos) => {
      if (node.type.name === 'fileAttachment' && node.attrs.src === matchSrc) {
        tr.delete(pos, pos + node.nodeSize)
        return false
      }
    })
    if (tr.docChanged) editor.view.dispatch(tr)
  }

  return {
    openFilePicker,
    uploadAndInsert,
    isUploading,
  }
}
