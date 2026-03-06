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

export function useDocumentFileUpload() {
  const { batchUploadFiles } = useAttachment()

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
          // Find the node with matching blob URL and update its attrs
          updateFileNode(editor, blobUrl, { path: storedRef, src: '' })
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
    const { doc, tr } = editor.state
    doc.descendants((node, pos) => {
      if (node.type.name === 'fileAttachment' && node.attrs.src === matchSrc) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...newAttrs })
        return false
      }
    })
    editor.view.dispatch(tr)
  }

  /** Walk the doc tree to find and delete a fileAttachment node by src. */
  function removeFileNode(editor: Editor, matchSrc: string) {
    const { doc, tr } = editor.state
    doc.descendants((node, pos) => {
      if (node.type.name === 'fileAttachment' && node.attrs.src === matchSrc) {
        tr.delete(pos, pos + node.nodeSize)
        return false
      }
    })
    editor.view.dispatch(tr)
  }

  return {
    openFilePicker,
    uploadAndInsert,
    isUploading,
  }
}
