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
      alt: { default: null },
      title: { default: null },
      class: { default: 'mb-2' },
    }),
    parseHTML: () => [
      {
        tag: 'img[src]',
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
    renderHTML: ({ HTMLAttributes }) => ['img', HTMLAttributes],

    // @ts-expect-error todo: fix this
    addCommands() {
      return {
        setImage: (options: { src: any }) => async () => {
          if (options?.src instanceof File) {
            const url = await uploadFn(options.src)
            options.src = url
          }

          const view = this.editor.view
          const { schema } = view.state

          const node = schema.nodes.image.create({
            src: options.src,
          })

          const currentTextBlock = view.state.doc.nodeAt(view.state.selection.from - 1)!
          const currentParentNodePos = view.state.selection.from - 2 - currentTextBlock.nodeSize

          const transaction = view.state.tr
            .setSelection(NodeSelection.create(view.state.doc, currentParentNodePos))
            .replaceSelectionWith(node)
          view.dispatch(transaction)

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
      }
    },
    addProseMirrorPlugins() {
      return [dropImagePlugin(uploadFn)]
    },
  })
}
