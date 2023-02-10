import { Node, nodeInputRule } from '@tiptap/core'
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
          }
        },
      },
    ],
    renderHTML: ({ HTMLAttributes }) => ['img', HTMLAttributes],

    // @ts-expect-error todo: fix this
    addCommands() {
      return {
        setImage: (options: { src: any; clearCurrentNode?: boolean }) => async () => {
          if (options?.src instanceof File) {
            const url = await uploadFn(options.src)
            options.src = url
          }

          const view = this.editor.view

          const { selection } = view.state.tr
          const position = selection.anchor - 2

          if (options.clearCurrentNode) {
            const lastNode = view.state.doc.nodeAt(position)
            const childNode = lastNode?.firstChild
            if (childNode?.text === '/') {
              const transaction = view.state.tr.replaceWith(position, position + 1, view.state.schema.nodes.paragraph.create())
              view.dispatch(transaction)
            }
          }

          const node = this.editor.schema.nodes.image.create(options)
          const transaction = view.state.tr.replaceWith(position, position + 1, node)
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
    addProseMirrorPlugins() {
      return [dropImagePlugin(uploadFn)]
    },
  })
}
