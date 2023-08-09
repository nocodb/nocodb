import type { ChainedCommands } from '@tiptap/core'
import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { nodeTypesContainingListItems } from '../helper'
import type { ListNodeType } from './helper'
import { changeLevel, isSelectionOfType, listItemPasteRule, onBackspace, onEnter } from './helper'
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
  name: TiptapNodesTypes.ordered,

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
                type: TiptapNodesTypes.paragraph,
              },
            ],
          })
        },
      toggleOrdered:
        () =>
        ({ chain, state }: any) => {
          toggleItem({ chain, state, type: TiptapNodesTypes.ordered })
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
        return onBackspace(this.editor as any, this.name as any)
      },
    }
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
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
        nodeType: TiptapNodesTypes.ordered,
        pasteRegex,
      }),
    ]
  },

  addProseMirrorPlugins() {
    const plugin = new PluginKey(this.name)
    return [
      new Plugin({
        key: plugin,
        // Fix the order number of ordered list when page is updated
        appendTransaction(_, __, newState) {
          const tr = newState.tr
          const { doc } = newState
          let currentNumber = 1
          let found = false

          doc.descendants((node, pos) => {
            if (
              nodeTypesContainingListItems.includes(node.type.name as TiptapNodesTypes) ||
              node.type.name === TiptapNodesTypes.ordered
            ) {
              if (node.type.name === TiptapNodesTypes.ordered) {
                const number = node.attrs.number
                if (String(number) !== String(currentNumber)) {
                  found = true
                  tr.setNodeMarkup(pos, undefined, {
                    number: String(currentNumber),
                  })
                }
                currentNumber++
              }

              // Should to traverse deeper in tree if the node is not a nodeTypesContainingListItems
              return node.type.name !== TiptapNodesTypes.ordered
            } else {
              // Reset the current number as ordered list group is over i.e current node is a normal paragraph
              currentNumber = 1
              return false
            }
          })

          return found ? tr : undefined
        },
        state: {
          init() {
            return {
              active: false,
            }
          },
          apply(tr, prev, oldState, newState) {
            if (isSelectionOfType(newState, TiptapNodesTypes.ordered)) {
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
