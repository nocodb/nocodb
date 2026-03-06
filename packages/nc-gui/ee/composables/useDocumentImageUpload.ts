/**
 * Composable for uploading images in the document editor.
 *
 * Wraps useAttachment with document-specific logic:
 * - Opens a native file picker filtered to images
 * - Uploads via NocoDB's storage API
 * - Inserts an image node into the Tiptap editor with instant blob preview,
 *   then swaps the src for the permanent path once uploaded
 */
import type { Editor } from '@tiptap/core'

export function useDocumentImageUpload() {
  const { batchUploadFiles } = useAttachment()
  const { appInfo, token } = useGlobal()

  const base = inject(ProjectInj, ref())
  const docId = inject<Ref<string>>('DocIdInj', ref(''))

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

  /** Build the proxy URL for a doc attachment. Used as <img src> — auth via cookie. */
  function buildProxyUrl(urlOrPath: string): string {
    const baseId = base?.value?.id
    const docIdVal = docId?.value
    if (!baseId || !docIdVal || !urlOrPath) return ''
    return `${appInfo.value.ncSiteUrl}/api/v2/meta/bases/${baseId}/docs/${docIdVal}/attachment?urlOrPath=${encodeURIComponent(
      urlOrPath,
    )}`
  }

  /**
   * Fetch a doc attachment via the auth-protected proxy and return a blob URL.
   * The auth token is sent in the request header — never exposed in the URL.
   */
  async function fetchDocAttachment(urlOrPath: string): Promise<string> {
    const url = buildProxyUrl(urlOrPath)
    if (!url) return ''
    try {
      const response = await fetch(url, {
        headers: { 'xc-auth': token.value || '' },
      })
      if (!response.ok) return ''
      const blob = await response.blob()
      return URL.createObjectURL(blob)
    } catch {
      return ''
    }
  }

  /**
   * Upload a file and insert an image node into the editor.
   *
   * Flow:
   * 1. Create a blob preview URL for instant feedback
   * 2. Insert image node with blob src (path = null)
   * 3. Upload file to storage API
   * 4. On success: walk the doc to find the node with matching blob src,
   *    update its attrs with permanent path (src cleared — DocImageNode
   *    will fetch through the proxy on next resolveSrc)
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

      if (uploaded.length) {
        const att = uploaded[0]
        const storedRef = att.path || att.url
        if (storedRef) {
          updateImageNode(editor, blobUrl, { path: storedRef, src: '' })
        } else {
          removeImageNode(editor, blobUrl)
        }
      } else {
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
    fetchDocAttachment,
    buildProxyUrl,
    isUploading,
  }
}
