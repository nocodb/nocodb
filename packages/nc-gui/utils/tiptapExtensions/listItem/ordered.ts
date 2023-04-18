import type { ChainedCommands } from '@tiptap/core'
import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { changeLevel, isSelectionOfType, listItemPasteRule, onBackspaceWithNestedList, onEnter } from './helper'
export interface OrderItemsOptions {
  number: string
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ordered: {
      toggleOrdered: () => ReturnType
      insertOrdered: () => ReturnType
      isSelectionTypeOrdered: () => boolean
    }
  }
}

const inputRegex = /^\s*\d+\.\s/gm
const pasteRegex = /^\s*\d+\.\s+(.*)$/gm

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
        tag: 'ol > li',
        node: 'ordered',
        style: 'list-style-type: decimal',
        getAttrs: (element) => {
          const start = (element as HTMLElement).parentElement?.getAttribute('start') || '1'
          const childIndex = Array.from((element as HTMLElement).parentElement?.children || []).indexOf(element as HTMLElement)

          return {
            number: String(Number(start) + childIndex),
            level: 0,
          }
        },
      },
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
      level: {
        default: 0,
        parseHTML: (element) => element.getAttribute('data-level'),
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': node.type.name,
        'data-number': node.attrs.number,
        'data-level': node.attrs.level,
        'style': `padding-left: ${Number(node.attrs.level)}rem;`,
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
      ['div', { 'class': 'tiptap-list-item-content', 'data-number': node.attrs.number }, 0],
    ]
  },

  addCommands() {
    return {
      isSelectionTypeOrdered:
        () =>
        ({ state }: any) => {
          return isSelectionOfType(state, this.name)
        },
      insertOrdered:
        () =>
        ({ chain }: any) => {
          return (chain() as ChainedCommands).insertContent({
            type: this.name,
            attrs: {
              number: '1',
            },
            content: [
              {
                type: 'paragraph',
              },
            ],
          })
        },
      toggleOrdered:
        () =>
        ({ chain }: any) => {
          toggleItem({ editor: this.editor, chain, type: 'ordered' })
        },
    } as any
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-3': () => {
        const selection = this.editor.state.selection

        if (!selection.empty) {
          this.editor.chain().focus().toggleOrdered().run()
          return true
        }

        const from = selection.$from.before(selection.$from.depth) + 1
        const to = selection.$from.after(selection.$from.depth)

        this.editor.chain().focus().setTextSelection({ from, to }).toggleOrdered().run()
        return true
      },
      'Enter': () => {
        return onEnter(this.editor, this.name as any)
      },
      'Tab': () => {
        return changeLevel(this.editor, this.name, 'forward')
      },
      'Shift-Tab': () => {
        return changeLevel(this.editor, this.name, 'backward')
      },
      'Backspace': () => {
        return onBackspaceWithNestedList(this.editor, this.name as any)
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
      listItemPasteRule({
        inputRegex,
        nodeType: 'ordered',
        pasteRegex,
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
