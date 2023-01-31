import type { EditorView } from 'prosemirror-view'
import { Plugin, TextSelection } from 'prosemirror-state'

export type UploadFn = (image: File) => Promise<string>

export const addImage = async (image: File, view: EditorView, upload: any) => {
  const { schema } = view.state

  const url = (await upload(image)) as string

  const node = schema.nodes.image.create({
    src: url,
  })

  const transaction = view.state.tr.replaceSelectionWith(node)
  view.dispatch(transaction)

  let currentCursorPos = view.state.selection.$anchor.pos

  // verify if we are in the end of the document
  if (currentCursorPos + 1 === view.state.doc.content.size) {
    currentCursorPos = currentCursorPos + 1
    const insertParaTr = view.state.tr.insert(currentCursorPos, schema.nodes.paragraph.create())
    view.dispatch(insertParaTr)
  }

  const newSelection = view.state.tr.doc.resolve(currentCursorPos)
  const focusTransaction = view.state.tr.setSelection(new TextSelection(newSelection, newSelection))
  view.dispatch(focusTransaction)
}

export const dropImagePlugin = (upload: UploadFn) => {
  return new Plugin({
    commands: {
      insertImage: (attrs: { src: string }) => (state: any, dispatch: any) => {
        const { selection, schema } = state
        const position = selection.$cursor ? selection.$cursor.pos : selection.$to.pos
        const node = schema.nodes.image.create({
          src: attrs.src,
        })
        const transaction = state.tr.insert(position, node)
        dispatch(transaction)
      },
    },
    props: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || [])
        event.preventDefault()

        for (const item of items) {
          const image = item.getAsFile()
          if (!image || item.type.indexOf('image') !== 0) continue

          addImage(image, view, upload)
        }

        return false
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length
          console.log('handleDOMEvents', { event, view })

          if (!hasFiles) return false

          const images = Array.from(event.dataTransfer?.files ?? []).filter((file) => /image/i.test(file.type))
          if (images.length === 0) return false
          event.preventDefault()

          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })
          if (!coordinates) return false

          images.forEach(async (image) => {
            addImage(image, view, upload)
          })

          return true
        },
      },
    },
  })
}
