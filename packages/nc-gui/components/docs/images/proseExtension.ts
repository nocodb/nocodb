import type { EditorView } from 'prosemirror-view'
import { Plugin, TextSelection } from 'prosemirror-state'

export type UploadFn = (image: File) => Promise<string>

export const createNewParagraph = (view: EditorView) => {
  const { schema } = view.state
  let currentCursorPos = view.state.selection.$anchor.pos

  // verify if we are in the end of the document
  if (currentCursorPos + 1 === view.state.doc.content.size) {
    currentCursorPos = currentCursorPos + 1
    const insertParaTr = view.state.tr.insert(currentCursorPos, schema.nodes.paragraph.create())
    view.dispatch(insertParaTr)
  }

  const newSelection = view.state.tr.doc.resolve(currentCursorPos + 1)
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
        const { schema } = view.state

        items.forEach((item) => {
          const image = item.getAsFile()

          if (item.type.indexOf('image') === 0) {
            event.preventDefault()

            if (upload && image) {
              upload(image).then((src) => {
                const node = schema.nodes.image.create({
                  src,
                })
                const transaction = view.state.tr.replaceSelectionWith(node)
                view.dispatch(transaction)

                createNewParagraph(view)
              })
            }
          } else {
            const reader = new FileReader()
            reader.onload = (readerEvent) => {
              const node = schema.nodes.image.create({
                src: readerEvent.target?.result,
              })
              const transaction = view.state.tr.replaceSelectionWith(node)
              view.dispatch(transaction)

              createNewParagraph(view)
            }
            if (!image) return
            reader.readAsDataURL(image)
          }
        })

        return false
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length
          console.log('handleDOMEvents', { event, view })

          if (!hasFiles) {
            return false
          }

          const images = Array.from(event.dataTransfer?.files ?? []).filter((file) => /image/i.test(file.type))

          if (images.length === 0) {
            return false
          }

          event.preventDefault()

          const { schema } = view.state
          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })
          if (!coordinates) return false

          images.forEach(async (image) => {
            const reader = new FileReader()

            if (upload) {
              const node = schema.nodes.image.create({
                src: await upload(image),
              })
              const transaction = view.state.tr.insert(coordinates.pos, node)
              view.dispatch(transaction)

              createNewParagraph(view)
            } else {
              reader.onload = (readerEvent) => {
                const node = schema.nodes.image.create({
                  src: readerEvent.target?.result,
                })
                const transaction = view.state.tr.insert(coordinates.pos, node)
                view.dispatch(transaction)

                createNewParagraph(view)
              }
              reader.readAsDataURL(image)
            }
          })

          return true
        },
      },
    },
  })
}
