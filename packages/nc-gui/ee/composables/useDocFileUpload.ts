/**
 * Composable for uploading file attachments in the doc editor.
 *
 * Similar to useDocImageUpload but handles any file type:
 * - Opens a native file picker (no accept filter)
 * - Uploads via NocoDB's storage API to noco/docs path
 * - Inserts a fileAttachment node with instant blob reference,
 *   then swaps to permanent path once uploaded
 */
import type { Editor } from '@tiptap/core'
import useAttachment from '~/composables/useAttachment'

export function useDocFileUpload() {
  const { batchUploadFiles, getPossibleAttachmentSrc } = useAttachment()

  const isUploading = ref(false)

  /** Open native file picker for any file type. Returns selected File or null. */
  function openFilePicker(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.style.display = 'none'
      input.addEventListener('change', () => {
        const file = input.files?.[0] || null
        input.remove()
        resolve(file)
      })
      input.addEventListener('cancel', () => {
        input.remove()
        resolve(null)
      })
      document.body.appendChild(input)
      input.click()
    })
  }

  /**
   * Upload a file and insert a fileAttachment node into the editor.
   *
   * Flow:
   * 1. Create a blob URL as temporary reference
   * 2. Insert fileAttachment node with blob src (path = null)
   * 3. Upload file to storage API
   * 4. On success: walk doc to find the node with matching src, update its path
   * 5. On failure: remove the placeholder node
   */
  async function uploadAndInsert(editor: Editor, file: File) {
    const blobUrl = URL.createObjectURL(file)

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

    isUploading.value = true
    try {
      const uploaded = await batchUploadFiles([file], 'noco/docs')

      if (uploaded.length && uploaded[0].path) {
        const path = uploaded[0].path
        // Find the node with matching blob URL and update its attrs
        updateFileNode(editor, blobUrl, { path, src: '' })
      } else {
        removeFileNode(editor, blobUrl)
      }
    } catch {
      removeFileNode(editor, blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
      isUploading.value = false
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
