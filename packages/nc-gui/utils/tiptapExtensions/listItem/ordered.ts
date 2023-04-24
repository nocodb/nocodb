import type { ChainedCommands } from '@tiptap/core'
import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { ListNodeType } from './helper'
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

// inputRegex Regex for detecting start of list item while typing. i.e '- ' for bullet list
// pasteRegex Regex for detecting start of list item while pasting. i.e '- Content' for bullet list
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
          return isSelectionOfType(state, this.name as ListNodeType)
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
        ({ chain, state }: any) => {
          toggleItem({ chain, state, type: 'ordered' })
        },
    } as any
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-3': () => {
        this.editor.chain().focus().selectActiveSectionFirstChild().toggleOrdered().run()
        return true
      },
      'Enter': () => {
        return onEnter(this.editor as any, this.name as ListNodeType)
      },
      'Tab': () => {
        return changeLevel(this.editor as any, this.name as ListNodeType, 'forward')
      },
      'Shift-Tab': () => {
        return changeLevel(this.editor as any, this.name as ListNodeType, 'backward')
      },
      'Backspace': () => {
        return onBackspaceWithNestedList(this.editor as any, this.name as any)
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
