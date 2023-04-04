import { Node, nodeInputRule } from '@tiptap/core'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import type { UploadFn } from './proseExtension'
import { dropImagePlugin } from './proseExtension'
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
      'img',
      { ...HTMLAttributes, class: HTMLAttributes.class ? `cursor-pointer ${HTMLAttributes.class}` : 'cursor-pointer' },
    ],

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
            const prevNode = editor.view.state.doc.nodeAt(prevNodePos)

            if (prevNode?.type.name === 'image') {
              editor.chain().setNodeSelection(prevNodePos).run()
              return true
            }

            return false
          } catch (error) {
            console.log('error', error)
            return false
          }
        },
      }
    },
    addProseMirrorPlugins() {
      return [dropImagePlugin(uploadFn)]
    },
  })
}
