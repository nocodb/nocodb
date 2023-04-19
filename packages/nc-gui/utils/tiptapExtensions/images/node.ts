import { Node, nodeInputRule } from '@tiptap/core'
import { TextSelection } from 'prosemirror-state'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { UploadFn } from './proseExtension'
import { addImage, dropImagePlugin } from './proseExtension'
import ImageComponent from './image.vue'
/**
 * Matches following attributes in Markdown-typed image: [, alt, src, title]
 *
 * Example:
 * ![Lorem](image.jpg) -> [, "Lorem", "image.jpg"]
 * ![](image.jpg "Ipsum") -> [, "", "image.jpg", "Ipsum"]
 * ![Lorem](image.jpg "Ipsum") -> [, "Lorem", "image.jpg", "Ipsum"]
 */
const IMAGE_INPUT_REGEX = /!\[(.+|:?)\]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/

export const createImageExtension = (uploadFn: UploadFn) => {
  return Node.create({
    name: 'image',
    group: 'block',
    draggable: true,
    addAttributes: () => ({
      src: {},
      isUploading: { default: false },
      alt: { default: null },
      title: { default: null },
      class: { default: '' },
      id: { default: null },
      width: {
        default: 450,
        parseHTML: (element) => {
          const width = element.getAttribute('width')
          return width ? parseInt(width, 10) : undefined
        },
      },
      height: {
        default: 400,
        parseHTML: (element) => {
          const height = element.getAttribute('height')
          return height ? parseInt(height, 10) : undefined
        },
      },
    }),
    parseHTML: () => [
      {
        tag: 'img',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {}
          const element = dom as HTMLImageElement

          return {
            src: element.getAttribute('src'),
            title: element.getAttribute('title'),
            alt: element.getAttribute('alt'),
            class: element.getAttribute('class'),
          }
        },
      },
    ],
    renderHTML: ({ HTMLAttributes }) => [
      'div',
      {
        ...HTMLAttributes,
        class: HTMLAttributes.class ? `image-wrapper cursor-pointer ${HTMLAttributes.class}` : 'image-wrapper cursor-pointer',
      },
    ],

    addNodeView() {
      return VueNodeViewRenderer(ImageComponent)
    },

    // @ts-expect-error todo: fix this
    addCommands() {
      return {
        setImage: (options: { src: any }) => async () => {
          const view = this.editor.view

          const currentTextBlock = view.state.doc.nodeAt(view.state.selection.from - 1)!
          const currentParentNodePos = view.state.selection.from - 2 - currentTextBlock.nodeSize

          // Otherwise prose mirror will throw an error, regarding transaction mismatch
          await new Promise((resolve) => setTimeout(resolve, 0))

          await addImage(options.src, view, uploadFn, currentParentNodePos)

          return true
        },
      }
    },
    addInputRules() {
      return [
        nodeInputRule({
          find: IMAGE_INPUT_REGEX,
          type: this.type,
          getAttributes: (match) => {
            const [, alt, src, title] = match
            return {
              src,
              alt,
              title,
            }
          },
        }),
      ]
    },
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          // Set cursor to the next line
          const state = this.editor.state
          const { tr } = state
          const selectedNode = state.selection.$from.node()
          const selectedContent = selectedNode?.content
          const isImage = selectedContent.firstChild?.type.name === 'image'
          if (!isImage) return

          tr.setSelection(TextSelection.create(tr.doc, state.selection.$from.pos + 2))
          this.editor.view.dispatch(tr)
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
            if (prevNode?.type.name !== 'image') return false

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
      } as any
    },
    addProseMirrorPlugins() {
      return [dropImagePlugin(uploadFn)]
    },
  })
}
