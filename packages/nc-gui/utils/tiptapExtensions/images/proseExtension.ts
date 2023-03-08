import type { EditorView } from 'prosemirror-view'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { NodeSelection, Plugin } from 'prosemirror-state'

export type UploadFn = (image: File) => Promise<string>

export const addImage = async (image: File, view: EditorView, upload: any, replacePrevNodePos?: number) => {
  const { schema } = view.state
  const id = Math.random().toString(36).substr(2, 9)
  const emptyNode = schema.nodes.image.create({
    src: '',
    isUploading: true,
    id,
  })

  const pos = replacePrevNodePos ?? view.state.selection.from - 2

  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).replaceSelectionWith(emptyNode))

  const url = (await upload(image)) as string
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
      decorations: ({ doc }) => {
        const decorations: Decoration[] = []

        doc.descendants((wrapperNode, wrapperPos) => {
          if (wrapperNode.childCount === 0) return false
          if (wrapperNode.child(0).type.name !== 'image') return false
          if (!wrapperNode.child(0).attrs.isUploading) return false

          const decoration = Decoration.widget(wrapperPos + 1, () => {
            const wrapper = document.createElement('div')
            wrapper.classList.add('image-uploading-wrapper')

            const uploadingDom = document.createElement('div')
            uploadingDom.classList.add('image-uploading')
            uploadingDom.innerHTML = 'Uploading...'
            wrapper.appendChild(uploadingDom)

            return wrapper
          })

          decorations.push(decoration)

          return true
        })

        return DecorationSet.create(doc, decorations)
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || [])
        event.preventDefault()
        let isImageAdded = false

        for (const item of items) {
          const image = item.getAsFile()
          if (!image || item.type.indexOf('image') !== 0) continue

          addImage(image, view, upload)
          isImageAdded = true
        }

        return isImageAdded
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length

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
