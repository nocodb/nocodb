import type { EditorView } from 'prosemirror-view'
import { NodeSelection, Plugin } from 'prosemirror-state'
import { getPositionOfSection } from '../section/helpers'

export type UploadFn = (image: File) => Promise<string>

export const addImage = async ({
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
  const emptyNode = schema.nodes.image.create({
    src: '',
    isUploading: true,
    id,
  })

  const pos = toBeInsertedPos ?? getPositionOfSection(view.state)

  view.dispatch(view.state.tr.insert(pos, emptyNode))

  const url = (await uploadFn(file)) as string
  const node = schema.nodes.image.create({
    src: url,
  })

  // traverse the document to find the uploading image node
  // and replace it with the uploaded image node
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

export const dropImagePlugin = (uploadFn: UploadFn) => {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        event.preventDefault()

        const items = Array.from(event.clipboardData?.items || [])
        let isImageAdded = false

        for (const item of items) {
          const file = item.getAsFile()
          if (!file || item.type.indexOf('image') !== 0) continue

          addImage({ file, view, uploadFn })
          isImageAdded = true
        }

        return isImageAdded
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const domsFromEventPoint = document.elementsFromPoint(event.clientX, event.clientY)

          const sectionDom = domsFromEventPoint.find((dom) => dom.hasAttribute('tiptap-draghandle-wrapper'))
          if (!sectionDom) return false

          const currentSectionPos = Number(sectionDom.getAttribute('pos'))

          const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length
          if (!hasFiles) return false

          event.preventDefault()

          const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => /image/i.test(file.type))
          if (files.length === 0) return false

          files.forEach(async (file) => {
            addImage({ file, view, uploadFn, toBeInsertedPos: currentSectionPos })
          })

          return true
        },
      },
    },
  })
}
