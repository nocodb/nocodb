import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { UploadFn } from './proseExtension'
import { addFile, dropAttachmentPlugin } from './proseExtension'
import AttachmentComponent from './attachment.vue'

export const createAttachmentExtension = (uploadFn: UploadFn) => {
  return Node.create({
    name: 'attachment',
    group: 'block',
    addAttributes: () => ({
      url: {},
      isUploading: { default: false },
      class: { default: '' },
      name: { default: '' },
      id: { default: null },
      size: { default: null },
    }),
    renderHTML: ({ HTMLAttributes }) => [
      'div',
      {
        ...HTMLAttributes,
        class: HTMLAttributes.class
          ? `attachment-wrapper cursor-pointer ${HTMLAttributes.class}`
          : 'attachment-wrapper cursor-pointer',
      },
    ],

    addNodeView() {
      return VueNodeViewRenderer(AttachmentComponent)
    },

    addCommands() {
      return {
        setAttachment: (options: FileList) => async () => {
          const view = this.editor.view

          const parentPos = view.state.selection.$from.before(2)
          this.editor.chain().setNodeSelection(parentPos).deleteSelection().run()

          // Otherwise prose mirror will throw an error, regarding transaction mismatch
          await new Promise((resolve) => setTimeout(resolve, 0))

          await Promise.all(
            Array.from(options).map(async (file) => {
              await addFile(file, view, uploadFn, parentPos)
            }),
          )

          return true
        },
      } as any
    },
    addKeyboardShortcuts() {
      return {
        Enter: ({ editor }) => {
          // Set cursor to the next line
          const selection = editor.state.selection
          const currentNode = selection.$from.node()
          const currentChildNode = selection.$from.node().child(0)
          if (currentChildNode?.type.name !== 'attachment') {
            return false
          }

          editor
            .chain()
            .focus(selection.$from.pos + currentNode.nodeSize)
            .run()
          return true
        },
        Backspace: () => {
          try {
            const editor = this.editor
            const selection = editor.view.state.selection
            const node = selection.$from.node()
            const parentNode = selection.$from.node(-1)

            if (!(node.type.name === 'paragraph' && parentNode.type.name === 'dBlock')) {
              return false
            }

            const prevNodePos = selection.$from.pos - (parentNode.nodeSize - node.nodeSize + 2)
            if (prevNodePos < 0) return false
            const prevNode = editor.view.state.doc.nodeAt(prevNodePos)
            if (prevNode?.type.name !== 'attachment') return false

            const currentNode = selection.$from.node()
            if (currentNode.type.name === 'paragraph' && currentNode.textContent.length === 0) {
              editor
                .chain()
                .setNodeSelection(selection.$from.pos - 1)
                .deleteSelection()
                .setTextSelection(prevNodePos)
                .run()
              return true
            }

            editor.chain().setNodeSelection(prevNodePos).run()
            return true
          } catch (error) {
            console.log('error', error)
            return false
          }
        },
      }
    },
    addProseMirrorPlugins() {
      return [dropAttachmentPlugin(uploadFn)]
    },
  })
}
