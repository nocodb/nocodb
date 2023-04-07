import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'

import { Plugin, PluginKey } from 'prosemirror-state'
import {
  changeLevel,
  getTextAsParagraphFromSliceJson,
  isSelectionOfType,
  onBackspaceWithNestedList,
  onEnter,
  toggleItem,
} from './helper'

export interface ListOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bullet: {
      isSelectionTypeBullet: () => boolean
      toggleBullet: () => ReturnType
    }
  }
}

const inputRegex = /^\s*([-+*])\s$/g

export const Bullet = Node.create<ListOptions>({
  name: 'bullet',
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      level: {
        default: 0,
        parseHTML: (element) => element.getAttribute('data-level'),
      },
    }
  },

  group: 'block',

  content() {
    return 'paragraph'
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="bullet"]',
        attrs: { 'data-type': 'bullet' },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': node.type.name,
        'data-level': node.attrs.level,
        'style': `padding-left: ${Number(node.attrs.level)}rem;`,
      }),
      ['div', { class: 'tiptap-list-item-content' }, 0],
    ]
  },

  addCommands() {
    return {
      isSelectionTypeBullet:
        () =>
        ({ state }: any) => {
          return isSelectionOfType(state, this.name)
        },
      toggleBullet:
        () =>
        ({ chain, state }: any) => {
          const toggleListItemInSliceJson = (content: any[]) => {
            for (const child of content) {
              if (child.type !== this.name) {
                child.content = [getTextAsParagraphFromSliceJson(child)]
                child.type = this.name
              } else {
                child.type = 'paragraph'

                if (child.content?.length === 1) {
                  child.content = child.content[0].content
                } else {
                  child.content = []
                }
              }
            }
          }

          toggleItem(state, chain, toggleListItemInSliceJson, 'bullet')
        },
    } as any
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-2': () => {
        const selection = this.editor.state.selection

        if (!selection.empty) {
          this.editor.chain().focus().toggleBullet().run()
          return true
        }

        const from = selection.$from.before(selection.$from.depth) + 1
        const to = selection.$from.after(selection.$from.depth)

        this.editor.chain().focus().setTextSelection({ from, to }).toggleBullet().run()
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
            if (isSelectionOfType(newState, 'bullet')) {
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
