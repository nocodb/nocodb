import { Node, mergeAttributes, nodePasteRule, wrappingInputRule } from '@tiptap/core'
import { Fragment, Slice } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import { addPastedContentToTransaction, getTextAsParagraphFromSliceJson, getTextFromSliceJson } from './helper'

export interface OrderItemsOptions {
  number: string
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ordered: {
      toggleOrdered: () => ReturnType
    }
  }
}

const inputRegex = /^\d+\.\s+(.*)$/gm
const inputPasteRegex = /^\d+\.\s+(.*)$/gm

export const Ordered = Node.create<OrderItemsOptions>({
  name: 'ordered',

  addOptions() {
    return {
      number: '1',
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content() {
    return 'paragraph'
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="ordered"]',
        attrs: { 'data-type': 'ordered' },
      },
    ]
  },

  addAttributes() {
    return {
      number: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute('data-number')

          return value || ''
        },
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': node.type.name,
        'data-number': node.attrs.number,
      }),
      [
        'div',
        {
          class: 'tiptap-list-item-start',
        },
        [
          'span',
          {
            'data-number': node.attrs.number,
          },
        ],
      ],
      ['div', { class: 'tiptap-list-item-content' }, 0],
    ]
  },

  addCommands() {
    return {
      toggleOrdered:
        () =>
        ({ chain, state }) => {
          const { selection } = state

          const topDBlockPos = selection.$from.before(1)

          const bottomDBlockPos = selection.$to.after(1)

          const slice = state.doc.slice(topDBlockPos, bottomDBlockPos)
          const sliceJson = slice.toJSON()

          let prevOrderedListNodeNumber = 0
          // Toggle a bullet under `dblock` nodes in slice
          for (const node of sliceJson.content) {
            if (node.type === 'dBlock') {
              for (const child of node.content) {
                if (child.type !== this.name && getTextFromSliceJson(child).length > 0) {
                  child.content = [getTextAsParagraphFromSliceJson(child)]
                  child.type = this.name
                  child.attrs = {
                    number: String(prevOrderedListNodeNumber + 1),
                  }

                  prevOrderedListNodeNumber = prevOrderedListNodeNumber + 1
                } else {
                  prevOrderedListNodeNumber = 0
                  child.type = 'paragraph'

                  if (child.content.length === 1) {
                    child.content = child.content[0].content
                  }
                }
              }
            }
          }

          const newSlice = Slice.fromJSON(state.schema, sliceJson)

          return chain()
            .command(() => {
              const tr = state.tr
              tr.replaceRange(topDBlockPos, bottomDBlockPos, newSlice)

              return true
            })
            .setTextSelection(topDBlockPos + newSlice.size - 1)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-3': () => {
        return (this.editor.chain().focus() as any).toggleOrdered().run()
      },
      'Enter': () => {
        const { selection } = this.editor.state

        const parentNode = selection.$from.node(-1)
        if (parentNode.type.name !== 'ordered') return false
        const currentNode = selection.$from.node()

        // Delete the ordered point if it's empty
        const currentNodeIsEmpty = currentNode.textContent.length === 1
        if (currentNodeIsEmpty) {
          this.editor
            .chain()
            .focus()
            .setNodeSelection(selection.from - 1)
            .setNode('paragraph')
            .run()

          return true
        }

        const isMultiSelect = selection.from !== selection.to
        const currentNodePosResolve = this.editor.state.doc.resolve(selection.from)

        const from = selection.from
        const currentNodeEndPos = currentNodePosResolve.posAtIndex(1)

        // We check if cursor at the end of the ordered point
        const isEndOfOrdered = currentNodeEndPos === selection.to

        const sliceToBeMoved = this.editor.state.doc.slice(from, currentNodeEndPos)

        const sliceToBeMovedContent = !isEndOfOrdered
          ? sliceToBeMoved.toJSON().content
          : [
              {
                type: 'text',
                // We add space since otherwise insertion is being ignored
                // We then remove it in the end
                text: ' ',
              },
            ]

        this.editor
          .chain()
          .insertContentAt(currentNodeEndPos + 2, {
            type: 'dBlock',
            content: [
              {
                type: 'ordered',
                attrs: {
                  number: String(Number(parentNode.attrs.number) + 1),
                },
                content: [
                  {
                    type: 'paragraph',
                    content: isMultiSelect ? [] : sliceToBeMovedContent,
                  },
                ],
              },
            ],
          })
          .setTextSelection(currentNodeEndPos + 1)
          .deleteRange({ from, to: currentNodeEndPos })
          .command(({ tr }) => {
            if (isEndOfOrdered) {
              tr.deleteRange(currentNodeEndPos + 1, currentNodeEndPos + 2)
            }

            return true
          })
          .run()

        return true
      },
    }
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          console.log('match', match)
          const number = match[0].split('.')[0].trim()
          return {
            number,
          }
        },
      }),
    ]
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: inputRegex,
        type: this.type,
      }),
    ]
  },
})
