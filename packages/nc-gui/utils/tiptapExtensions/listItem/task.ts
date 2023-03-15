import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { Slice } from 'prosemirror-model'
import { NodeSelection, Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { getTextAsParagraphFromSliceJson, getTextFromSliceJson, isSelectionOfType, onEnter } from './helper'

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

const inputRegex = /^-?\s*\[[ x]\]\s+(.*)?\n?$/gm

export const Task = Node.create<TaskOptions>({
  name: 'task',

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
          return isSelectionOfType(state, this.name)
        },
      toggleTask:
        () =>
        ({ chain, state }: any) => {
          const { selection } = state

          const topDBlockPos = selection.$from.before(1)

          const bottomDBlockPos = selection.$to.after(1)

          const slice = state.doc.slice(topDBlockPos, bottomDBlockPos)
          const sliceJson = slice.toJSON()

          // Toggle a task under `dblock` nodes in slice
          for (const node of sliceJson.content) {
            if (node.type === 'dBlock') {
              for (const child of node.content) {
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
          }

          const newSlice = Slice.fromJSON(state.schema, sliceJson)
          const isEmpty = getTextFromSliceJson(sliceJson).length === 0

          return chain()
            .command(() => {
              const tr = state.tr
              tr.replaceRange(topDBlockPos, bottomDBlockPos, newSlice)

              return true
            })
            .setTextSelection(topDBlockPos + newSlice.size - 1)
            .setTextSelection(isEmpty ? topDBlockPos + newSlice.size - 1 : topDBlockPos + newSlice.size - 2)
        },
    } as any
  },

  onUpdate() {
    const selection = this.editor.state.selection
    const doc = this.editor.state.doc

    const parentNode = selection.$from.node(-1)
    if (parentNode.type.name !== 'bullet') return false

    let currentPos = selection.$from.before(1)
    let currentNode = doc.nodeAt(currentPos)
    let attempt = 1
    while (currentNode && currentNode.type.name !== 'bullet' && attempt < 10) {
      try {
        currentPos = selection.$from.before(attempt)
        currentNode = doc.nodeAt(currentPos)
      } finally {
        attempt++
      }
    }

    if (currentNode?.type.name !== 'bullet') return false

    const currentNodeText = currentNode.textContent.trimStart().toLowerCase()

    if (currentNodeText.startsWith('[ ]') || currentNodeText.startsWith('[x]')) {
      const isChecked = currentNodeText.startsWith('[x]')

      this.editor
        .chain()
        .focus()
        .setNodeSelection(currentPos)
        .deleteSelection()
        .insertContentAt(currentPos - 1, {
          type: 'task',
          content: [
            {
              type: 'paragraph',
              attrs: {
                checked: isChecked,
              },
              content: [
                {
                  type: 'text',
                  text: ' ',
                },
              ],
            },
          ],
        })
        .setTextSelection({ from: currentPos + 1, to: currentPos + 2 })
        .deleteSelection()
        .run()
    }
  },

  addKeyboardShortcuts() {
    return {
      'Backspace': () => {
        const { selection } = this.editor.state
        const { $from } = selection

        const node = $from.node(-1)
        const parentNode = $from.node(-2)
        if (node.type.name !== 'task' && parentNode.type.name !== 'tableCell') return false

        const nodeTextContent = node.textContent.trimStart().toLowerCase()
        if (nodeTextContent.length !== 0) return false

        this.editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.setSelection(NodeSelection.create(this.editor.state.doc, selection.from - 2))
            tr.replaceSelectionWith(this.editor.state.schema.nodes.paragraph.create())

            return true
          })
          .setTextSelection(selection.from - 2)
          .run()

        return true
      },
      'Ctrl-Alt-1': () => {
        ;(this.editor.chain().focus() as any).toggleTask().run()
        return true
      },
      'Enter': () => {
        return onEnter(this.editor, this.name as any)
      },
    }
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('div')
      listItem.setAttribute('data-type', 'task')
      const checkboxWrapper = document.createElement('label')
      const checkboxStyler = document.createElement('span')
      const checkbox = document.createElement('input')
      const content = document.createElement('div')

      checkboxWrapper.contentEditable = 'false'
      checkbox.type = 'checkbox'
      checkbox.addEventListener('change', (event) => {
        // if the editor isn’t editable and we don't have a handler for
        // readonly checks we have to undo the latest change
        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked

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
            checkbox.checked = !checkbox.checked
          }
        }
      })

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      listItem.dataset.checked = node.attrs.checked
      if (node.attrs.checked) {
        checkbox.setAttribute('checked', 'checked')
      }

      checkboxWrapper.append(checkbox, checkboxStyler)
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
            checkbox.setAttribute('checked', 'checked')
          } else {
            checkbox.removeAttribute('checked')
          }

          return true
        },
      }
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
            if (isSelectionOfType(newState, 'task')) {
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
