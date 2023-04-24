import type { EditorView } from 'prosemirror-view'
import { NodeSelection, Plugin } from 'prosemirror-state'
import { getPositionOfSection } from '../helper'

export type UploadFn = (attachment: File) => Promise<string>

export const addFile = async ({
  file,
  view,
  uploadFn,
  toBeInsertedPos,
}: {
  file: File
  view: EditorView
  uploadFn: any
  toBeInsertedPos?: number
}) => {
  const { schema } = view.state
  const id = Math.random().toString(36).substr(2, 9)
  const emptyNode = schema.nodes.attachment.create({
    url: '',
    isUploading: true,
    id,
    name: file.name,
    size: file.size,
    file,
  })

  const pos = toBeInsertedPos ?? getPositionOfSection(view.state)

  view.dispatch(view.state.tr.insert(pos, emptyNode))

  const url = (await uploadFn(file)) as string
  const node = schema.nodes.attachment.create({
    url,
    name: file.name,
    size: file.size,
  })

  // traverse the document to find the uploading attachment node
  // and replace it with the uploaded attachment node
  let uploadPos
  view.state.doc.descendants((node, pos) => {
    if (node.attrs.id === id && node.attrs.isUploading) {
      uploadPos = pos
      return false
    }

    return true
  })
  if (uploadPos === undefined) return

  const transaction = view.state.tr.setSelection(NodeSelection.create(view.state.doc, uploadPos)).replaceSelectionWith(node)
  view.dispatch(transaction)
}

export const dropAttachmentPlugin = (uploadFn: UploadFn) => {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || [])
        event.preventDefault()
        let isImageAdded = false

        for (const item of items) {
          const file = item.getAsFile()
          // skip if it's an image
          if (!file || item.type.includes('image')) continue

          addFile({ file, view, uploadFn })
          isImageAdded = true
        }

        return isImageAdded
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const domsOverElement = document.elementsFromPoint(event.clientX, event.clientY)

          const sectionDom = domsOverElement.find((dom) => dom.hasAttribute('tiptap-draghandle-wrapper'))
          if (!sectionDom) return false

          // We are setting pos attribute on the section dom, so that we can insert the attachment at the correct position
          const secPos = Number(sectionDom.getAttribute('pos'))
          const toBeInsertedPos = secPos

          const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length
          if (!hasFiles) return false

          // skip if it's an image
          const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => !file.type.includes('image'))
          if (files.length === 0) return false

          event.preventDefault()

          files.forEach(async (file) => {
            addFile({ file, view, uploadFn, toBeInsertedPos })
          })

          return true
        },
      },
    },
  })
}
