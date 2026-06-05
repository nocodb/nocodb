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
import type { DocAttachmentUploadOpts } from './useDocCollabFileRef'

export function useDocumentImageUpload(opts?: DocAttachmentUploadOpts) {
  const { batchUploadFiles } = useAttachment()
  const { appInfo, token } = useGlobal()

  const base = inject(ProjectInj, ref())
  const docId = inject(DocIdInj, ref(''))
  const smartTextCell = inject(SmartTextCellAttachmentInj, ref(null))
  const publicShare = inject(PublicDocShareInj, ref(null))

  const maybeCreateRef = useDocCollabFileRef(opts)

  const uploadCount = ref(0)
  const isUploading = computed(() => uploadCount.value > 0)

  /** Open native file picker restricted to images. Supports multiple selection. */
  function openFilePicker(options?: { multiple?: boolean }): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
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
   * Build the proxy URL for an attachment by FileReference ID. Used as <img src>
   * — auth via cookie.
   *
   * Branches on context: when SmartTextCellAttachmentInj is provided (cell-mode
   * editor inside the SmartText panel), the URL is keyed by table+column+row;
   * otherwise it's keyed by docId.
   */
  function buildProxyUrl(fileRefId: string): string {
    if (!fileRefId) return ''

    // Public-share viewer: no auth context, route through the UUID-gated
    // public endpoint.
    const pub = publicShare?.value
    if (pub?.sharedDocUuid && pub?.docId) {
      return `${appInfo.value.ncSiteUrl}/api/v2/public/shared-doc/${pub.sharedDocUuid}/doc/${
        pub.docId
      }/attachment/${encodeURIComponent(fileRefId)}`
    }

    const baseId = base?.value?.id
    if (!baseId) return ''

    const cell = smartTextCell?.value
    if (cell?.tableId && cell?.columnId && cell?.rowId) {
      return `${appInfo.value.ncSiteUrl}/api/v2/data/bases/${baseId}/tables/${cell.tableId}/columns/${
        cell.columnId
      }/rows/${encodeURIComponent(cell.rowId)}/attachment/${encodeURIComponent(fileRefId)}`
    }

    const docIdVal = docId?.value
    if (!docIdVal) return ''
    return `${appInfo.value.ncSiteUrl}/api/v2/data/bases/${baseId}/docs/${docIdVal}/attachment/${encodeURIComponent(fileRefId)}`
  }

  /**
   * Fetch a doc attachment via the auth-protected proxy and return a blob URL.
   * The auth token is sent in the request header — never exposed in the URL.
   */
  async function fetchDocAttachment(fileRefId: string): Promise<string> {
    const url = buildProxyUrl(fileRefId)
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
   * Upload an image and insert a node into the editor.
   *
   * If `existingBlobUrl` is provided, skip node insertion (already inserted)
   * and only perform the upload + attr swap.
   */
  async function uploadAndInsert(editor: Editor, file: File, existingBlobUrl?: string) {
    if (!file.type.startsWith('image/')) {
      // Clean up orphaned placeholder if already batch-inserted
      if (existingBlobUrl) removeImageNode(editor, existingBlobUrl)
      return
    }

    const blobUrl = existingBlobUrl || URL.createObjectURL(file)

    if (!existingBlobUrl) {
      // Insert placeholder image with blob preview
      editor.chain().focus().setImage({ src: blobUrl, alt: file.name }).run()
    }

    uploadCount.value++
    try {
      const uploaded = await batchUploadFiles([file], 'noco/docs')

      if (uploaded.length) {
        const att = uploaded[0]
        const storedRef = att.path || att.url
        if (storedRef) {
          const fileRefId = await maybeCreateRef(storedRef, file.size)
          updateImageNode(editor, blobUrl, fileRefId ? { path: storedRef, id: fileRefId } : { path: storedRef })
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
      uploadCount.value--
    }
  }

  /** Walk the doc tree to find an image node by src and update its attributes. */
  function updateImageNode(editor: Editor, matchSrc: string, newAttrs: Record<string, any>) {
    // Read fresh state to avoid stale positions from concurrent uploads
    const { doc, tr } = editor.view.state
    doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === matchSrc) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...newAttrs })
        return false
      }
    })
    if (tr.docChanged) editor.view.dispatch(tr)
  }

  /** Walk the doc tree to find and delete an image node by src. */
  function removeImageNode(editor: Editor, matchSrc: string) {
    const { doc, tr } = editor.view.state
    doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === matchSrc) {
        tr.delete(pos, pos + node.nodeSize)
        return false
      }
    })
    if (tr.docChanged) editor.view.dispatch(tr)
  }

  return {
    openFilePicker,
    uploadAndInsert,
    fetchDocAttachment,
    buildProxyUrl,
    isUploading,
  }
}
