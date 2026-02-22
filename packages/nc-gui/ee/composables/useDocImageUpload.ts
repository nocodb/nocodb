/**
 * Composable for uploading images in the doc editor.
 *
 * Wraps useAttachment with doc-specific logic:
 * - Opens a native file picker filtered to images
 * - Uploads via NocoDB's storage API
 * - Inserts an image node into the Tiptap editor with instant blob preview,
 *   then swaps the src for the permanent path once uploaded
 */
import type { Editor } from '@tiptap/core'
import useAttachment from '~/composables/useAttachment'

export function useDocImageUpload() {
  const { batchUploadFiles, getPossibleAttachmentSrc } = useAttachment()

  const isUploading = ref(false)

  /** Open native file picker restricted to images. Returns selected File or null. */
  function openFilePicker(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.style.display = 'none'
      input.addEventListener('change', () => {
        const file = input.files?.[0] || null
        input.remove()
        resolve(file)
      })
      // User cancelled — resolve null on focus return
      input.addEventListener('cancel', () => {
        input.remove()
        resolve(null)
      })
      document.body.appendChild(input)
      input.click()
    })
  }

  /** Resolve a stored attachment path to a displayable URL. */
  function resolveImageSrc(path: string): string {
    const sources = getPossibleAttachmentSrc({ path })
    return sources[0] || path
  }

  /**
   * Upload a file and insert an image node into the editor.
   *
   * Flow:
   * 1. Create a blob preview URL for instant feedback
   * 2. Insert image node with blob src (path = null)
   * 3. Upload file to storage API
   * 4. On success: walk the doc to find the node with matching blob src,
   *    update its attrs to { path, src: '' }
   * 5. On failure: remove the placeholder node
   */
  async function uploadAndInsert(editor: Editor, file: File) {
    if (!file.type.startsWith('image/')) return

    const blobUrl = URL.createObjectURL(file)

    // Insert placeholder image with blob preview
    editor.chain().focus().setImage({ src: blobUrl, alt: file.name }).run()

    isUploading.value = true
    try {
      const uploaded = await batchUploadFiles([file], 'noco/docs')

      if (uploaded.length && uploaded[0].path) {
        const path = uploaded[0].path
        // Find the image node with the blob URL and update its attrs
        updateImageNode(editor, blobUrl, { path, src: resolveImageSrc(path) })
      } else {
        // Upload failed — remove the placeholder
        removeImageNode(editor, blobUrl)
      }
    } catch {
      removeImageNode(editor, blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
      isUploading.value = false
    }
  }

  /** Walk the doc tree to find an image node by src and update its attributes. */
  function updateImageNode(editor: Editor, matchSrc: string, newAttrs: Record<string, any>) {
    const { doc, tr } = editor.state
    doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === matchSrc) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...newAttrs })
        return false // stop traversal
      }
    })
    editor.view.dispatch(tr)
  }

  /** Walk the doc tree to find and delete an image node by src. */
  function removeImageNode(editor: Editor, matchSrc: string) {
    const { doc, tr } = editor.state
    doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === matchSrc) {
        tr.delete(pos, pos + node.nodeSize)
        return false
      }
    })
    editor.view.dispatch(tr)
  }

  return {
    openFilePicker,
    uploadAndInsert,
    resolveImageSrc,
    getPossibleAttachmentSrc,
    isUploading,
  }
}
