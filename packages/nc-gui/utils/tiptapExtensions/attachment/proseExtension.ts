import type { EditorView } from 'prosemirror-view'
import { NodeSelection, Plugin } from 'prosemirror-state'

export type UploadFn = (attachment: File) => Promise<string>

export const addFile = async (attachment: File, view: EditorView, upload: any, prevNodePos?: number) => {
  const { schema } = view.state
  const id = Math.random().toString(36).substr(2, 9)
  const emptyNode = schema.nodes.attachment.create({
    url: '',
    isUploading: true,
    id,
    name: attachment.name,
    size: attachment.size,
    file: attachment,
  })

  const pos = prevNodePos ?? view.state.selection.$from.before(1)

  view.dispatch(view.state.tr.insert(pos, emptyNode))

  const url = (await upload(attachment)) as string
  const node = schema.nodes.attachment.create({
    url,
    name: attachment.name,
    size: attachment.size,
  })

  // traverse the document to find the uploading attachment node
  // and replace it with the uploaded attachment node
  let uploadPos = 0
  view.state.doc.descendants((node, pos) => {
    if (node.attrs.id === id && node.attrs.isUploading) {
      uploadPos = pos
      return false
    }

    return true
  })

  const transaction = view.state.tr.setSelection(NodeSelection.create(view.state.doc, uploadPos)).replaceSelectionWith(node)
  view.dispatch(transaction)
}

export const dropAttachmentPlugin = (upload: UploadFn) => {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || [])
        event.preventDefault()
        let isImageAdded = false

        for (const item of items) {
          const attachment = item.getAsFile()
          if (!attachment || item.type.includes('image')) continue

          addFile(attachment, view, upload)
          isImageAdded = true
        }

        return isImageAdded
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const domsOverElement = document.elementsFromPoint(event.clientX, event.clientY)
          const dbBlockDom = domsOverElement.find((dom) => dom.hasAttribute('tiptap-draghandle-wrapper'))
          if (!dbBlockDom) return false

          const dBlockPos = Number(dbBlockDom.getAttribute('pos'))
          const toBeInsertedPos = dBlockPos

          const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length

          if (!hasFiles) return false

          const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => !file.type.includes('image'))
          if (files.length === 0) return false
          event.preventDefault()

          files.forEach(async (attachment) => {
            addFile(attachment, view, upload, toBeInsertedPos)
          })

          return true
        },
      },
    },
  })
}
