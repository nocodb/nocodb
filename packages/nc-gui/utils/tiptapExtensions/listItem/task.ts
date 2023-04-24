import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { TiptapNodesTypes } from 'nocodb-sdk'

import { Plugin, PluginKey } from 'prosemirror-state'
import type { ListNodeType } from './helper'
import { changeLevel, isSelectionOfType, listItemPasteRule, onBackspaceWithNestedList, onEnter, toggleItem } from './helper'

export interface TaskOptions {
  HTMLAttributes: Record<string, any>
  checked: boolean
  nested: boolean
  onReadOnlyChecked: (node: ProseMirrorNode, checked: boolean) => boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    task: {
      toggleTask: () => ReturnType
      isSelectionTypeTask: () => boolean
    }
  }
}

// inputRegex Regex for detecting start of list item while typing. i.e '- ' for bullet list
// pasteRegex Regex for detecting start of list item while pasting. i.e '- Content' for bullet list
const inputRegex = /^\s*-?\s*\[[ xX]\]\s/gm
const pasteRegex = /^\s*-?\s*\[[ xX]\]\s+(.*)?\n?$/gm

export const Task = Node.create<TaskOptions>({
  name: TiptapNodesTypes.task,

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
      checked: false,
      nested: false,
    } as any
  },

  group: 'block',

  content() {
    return 'paragraph'
  },

  addAttributes() {
    return {
      checked: {
        default: null,
        parseHTML: (element) => element.getAttribute('checked') === 'true',
      },
      level: {
        default: 0,
        parseHTML: (element) => element.getAttribute('data-level'),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="task"]',
        attrs: { 'data-type': 'task' },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        'data-level': node.attrs.level,
        'style': `padding-left: ${Number(node.attrs.level)}rem;`,
      }),
      [
        'label',
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked ? 'checked' : 'unchecked',
          },
        ],
        ['span'],
      ],
      ['div', 0],
    ]
  },

  addCommands() {
    return {
      isSelectionTypeTask:
        () =>
        ({ state }: any) => {
          return isSelectionOfType(state, this.name as ListNodeType)
        },
      toggleTask:
        () =>
        ({ chain, state }: any) => {
          toggleItem({ chain, state, type: TiptapNodesTypes.task })
        },
    } as any
  },

  // Convert '- [ ]' to task
  // Required as while typing '- ' is converted to bullet list, so we need to convert it to task
  onUpdate() {
    const state = this.editor.state
    const selection = state.selection

    const listItemNodePos = selection.$from.before(selection.$from.depth - 1)
    const listItemNode = state.doc.nodeAt(listItemNodePos)

    if (listItemNode?.type.name !== TiptapNodesTypes.bullet) return false

    const listItemNodeText = listItemNode.textContent.trimStart().toLowerCase()

    if (listItemNodeText.startsWith('[ ]') || listItemNodeText.startsWith('[x]')) {
      const isChecked = listItemNodeText.startsWith('[x]')

      this.editor
        .chain()
        .focus()
        .setNodeSelection(listItemNodePos)
        .deleteSelection()
        .insertContentAt(listItemNodePos - 1, {
          type: TiptapNodesTypes.task,
          content: [
            {
              type: TiptapNodesTypes.paragraph,
              attrs: {
                checked: isChecked,
              },
              content: [
                {
                  type: TiptapNodesTypes.text,
                  text: ' ',
                },
              ],
            },
          ],
        })
        .setTextSelection(listItemNodePos + 1)
        .deleteSelection()
        .run()
    }
  },

  addKeyboardShortcuts() {
    return {
      'Backspace': () => {
        if (onBackspaceWithNestedList(this.editor as any, this.name as any)) return true

        return false
      },
      'Ctrl-Alt-1': () => {
        this.editor.chain().focus().selectActiveSectionFirstChild().toggleTask().run()
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
        nodeType: TiptapNodesTypes.task,
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
            if (isSelectionOfType(newState, TiptapNodesTypes.task)) {
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

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('div')
      listItem.setAttribute('data-type', 'task')
      listItem.setAttribute('data-level', node.attrs.level?.toString())
      listItem.style.paddingLeft = `${Number(node.attrs.level)}rem`

      const checkboxWrapper = document.createElement('label')
      const checkboxSpan = document.createElement('span')
      const checkboxInput = document.createElement('input')
      const content = document.createElement('div')

      checkboxWrapper.contentEditable = 'false'
      checkboxInput.type = 'checkbox'
      checkboxInput.addEventListener('change', (event) => {
        // if the editor isn’t editable and we don't have a handler for
        // readonly checks we have to undo the latest change
        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          checkboxInput.checked = !checkboxInput.checked

          return
        }

        const { checked } = event.target as any

        if (editor.isEditable && typeof getPos === 'function') {
          const position = getPos()
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .command(({ tr }) => {
              const currentNode = tr.doc.nodeAt(position)

              tr.setNodeMarkup(position, undefined, {
                ...currentNode?.attrs,
                checked,
              })

              return true
            })
            .setTextSelection(position + 1)
            .run()
        }
        if (!editor.isEditable && this.options.onReadOnlyChecked) {
          // Reset state if onReadOnlyChecked returns false
          if (!this.options.onReadOnlyChecked(node, checked)) {
            checkboxInput.checked = !checkboxInput.checked
          }
        }
      })

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      listItem.dataset.checked = node.attrs.checked
      if (node.attrs.checked) {
        checkboxInput.setAttribute('checked', 'checked')
      }

      checkboxWrapper.append(checkboxInput, checkboxSpan)
      listItem.append(checkboxWrapper, content)

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false
          }

          listItem.dataset.checked = updatedNode.attrs.checked
          if (updatedNode.attrs.checked) {
            checkboxInput.setAttribute('checked', 'checked')
          } else {
            checkboxInput.removeAttribute('checked')
          }

          listItem.setAttribute('data-level', updatedNode.attrs.level.toString())
          listItem.style.paddingLeft = `${Number(updatedNode.attrs.level)}rem`

          return true
        },
      }
    }
  },
})
