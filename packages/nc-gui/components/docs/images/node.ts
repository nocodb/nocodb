import { Node, nodeInputRule } from '@tiptap/core'
import { TextSelection } from 'prosemirror-state'
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
        setImage:
          (options: any) =>
          ({ tr, dispatch, view, state }: any) => {
            // todo: Similar code is in packages/nc-gui/components/docs/images/proseExtension.ts - createNewParagraph. Refactor this.
            const { selection } = tr
            const position = selection.$cursor ? selection.$cursor.pos : selection.$to.pos
            const node = this.type.create(options)
            const transaction = tr.insert(position - 1, node)
            dispatch(transaction)

            let currentCursorPos = view.state.selection.$anchor.pos

            // verify if we are in the end of the document
            if (currentCursorPos === state.doc.content.size) {
              currentCursorPos = currentCursorPos + 1
              const paragraphNode = view.state.schema.nodes.paragraph.create()
              const insertParaTr = tr.insert(currentCursorPos, paragraphNode)
              dispatch(insertParaTr)
            }

            const newSelection = tr.doc.resolve(currentCursorPos + 1)
            const focusTransaction = tr.setSelection(new TextSelection(newSelection, newSelection))
            dispatch(focusTransaction)

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
