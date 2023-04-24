import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { TiptapNodesTypes } from 'nocodb-sdk'
import type { ListNodeType } from './helper'
import { changeLevel, isSelectionOfType, listItemPasteRule, onBackspaceWithNestedList, onEnter, toggleItem } from './helper'

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

// inputRegex Regex for detecting start of list item while typing. i.e '- ' for bullet list
// pasteRegex Regex for detecting start of list item while pasting. i.e '- Content' for bullet list
const inputRegex = /^\s*([-+*])(?!\s*\[[ x]\])\s/gm
const pasteRegex = /^\s*([-+*])(?!\s*\[[ x]\])\s.+$/gm

export const Bullet = Node.create<ListOptions>({
  name: TiptapNodesTypes.bullet,
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
        tag: 'ul > li',
        node: 'bullet',
        style: 'list-style-type: disc',
      },
      {
        tag: 'div[data-type="bullet"]',
        attrs: { 'data-type': 'bullet' },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    let diskStyle = 'disc'
    switch (Number(node.attrs.level) % 3) {
      case 0:
        diskStyle = 'disc'
        break
      case 1:
        diskStyle = 'circle'
        break
      case 2:
        diskStyle = 'square'
        break
    }

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': node.type.name,
        'data-level': node.attrs.level,
        'data-disc-style': diskStyle,
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
          return isSelectionOfType(state, this.name as ListNodeType)
        },
      toggleBullet:
        () =>
        ({ chain, state }: any) => {
          toggleItem({ chain, state, type: TiptapNodesTypes.bullet })
        },
    } as any
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-2': () => {
        this.editor.chain().focus().selectActiveSectionFirstChild().toggleBullet().run()
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
      }),
    ]
  },

  addPasteRules() {
    return [
      listItemPasteRule({
        inputRegex,
        nodeType: TiptapNodesTypes.bullet,
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
            if (isSelectionOfType(newState, TiptapNodesTypes.bullet)) {
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
