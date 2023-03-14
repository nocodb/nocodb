import { Node, mergeAttributes, nodePasteRule, wrappingInputRule } from '@tiptap/core'
import { Slice } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { getTextAsParagraphFromSliceJson, getTextFromSliceJson, isSelectionOfType, onEnter } from './helper'
export interface OrderItemsOptions {
  number: string
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ordered: {
      toggleOrdered: () => ReturnType
      isSelectionTypeOrdered: () => boolean
    }
  }
}

const inputRegex = /^\d+\.\s+(.*)$/gm

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
      isSelectionTypeOrdered:
        () =>
        ({ state }: any) => {
          return isSelectionOfType(state, this.name)
        },
      toggleOrdered:
        () =>
        ({ chain, state }: any) => {
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

                  if (child.content?.length === 1) {
                    child.content = child.content[0].content
                  } else {
                    child.content = []
                  }
                }
              }
            }
          }

          const newSlice = Slice.fromJSON(state.schema, sliceJson)
          const isEmpty = getTextFromSliceJson(sliceJson).length === 0

          return chain()
            .command(() => {
              const tr = state.tr
              tr.replaceRange(topDBlockPos, bottomDBlockPos, newSlice)

              return true
            })
            .setTextSelection(isEmpty ? topDBlockPos + newSlice.size - 1 : topDBlockPos + newSlice.size - 2)
        },
    } as any
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-3': () => {
        ;(this.editor.chain().focus() as any).toggleOrdered().run()
        return true
      },
      'Enter': () => {
        return onEnter(this.editor, this.name as any)
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

  addProseMirrorPlugins() {
    const plugin = new PluginKey(this.name)
    return [
      new Plugin({
        key: plugin,
        state: {
          init() {
            return {
              active: false,
            }
          },
          apply(tr, prev, oldState, newState) {
            if (isSelectionOfType(newState, 'ordered')) {
              return {
                active: true,
              }
            } else {
              return {
                active: false,
              }
            }
          },
        },
      }),
    ]
  },
})
