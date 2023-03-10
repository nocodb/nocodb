import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { Fragment, Slice } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'

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
    }
  }
}

const inputPasteRegex = /^-?\s*\[[ x]\]\s+(.*)?\n?$/gm
const inputRegex = /^-?\s*\[[ x]\]\s+(.*)?\n?$/gm

let lastTransaction: any = null

export const Task = Node.create<TaskOptions>({
  name: 'task',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
      checked: false,
      nested: false,
    }
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
      toggleTask:
        () =>
        ({ chain, state }) => {
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
                  child.content = [structuredClone(child)]
                  child.type = this.name
                } else {
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

  onUpdate() {
    const selection = this.editor.state.selection

    const parentNode = selection.$from.node(-1)
    if (parentNode.type.name !== 'bullet') return false

    const parentNodePos = selection.$from.before(2)
    const currentNode = selection.$from.node()

    const currentNodeText = currentNode.textContent.trimStart().toLowerCase()

    if (currentNodeText.startsWith('[ ]') || currentNodeText.startsWith('[x]')) {
      const isChecked = currentNodeText.startsWith('[x]')

      this.editor
        .chain()
        .focus()
        .setNodeSelection(parentNodePos)
        .deleteSelection()
        .insertContentAt(parentNodePos, {
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
        .setTextSelection({ from: parentNodePos + 1, to: parentNodePos + 2 })
        .deleteSelection()
        .run()
    }
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-1': () => {
        return (this.editor.chain().focus() as any).toggleTask().run()
      },
      'Enter': () => {
        const { selection } = this.editor.state

        const parentNode = selection.$from.node(-1)
        if (parentNode.type.name !== 'task') return false
        const currentNode = selection.$from.node()

        // Delete the task point if it's empty
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

        // We check if cursor at the end of the task point
        const isEndOfTask = currentNodeEndPos === selection.to

        const sliceToBeMoved = this.editor.state.doc.slice(from, currentNodeEndPos)

        const sliceToBeMovedContent = !isEndOfTask
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
                type: 'task',
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
            if (isEndOfTask) {
              tr.deleteRange(currentNodeEndPos + 1, currentNodeEndPos + 2)
            }

            return true
          })
          .run()

        return true
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
    return [
      new Plugin({
        filterTransaction: (transaction) => {
          // todo: Hacky way to remove auto inserted line
          // Line is auto inserted when we paste text somewhere in tiptap editor
          // Find a way to avoid this auto insertion
          if (transaction.getMeta('task-paste-remove-auto-inserted-line')) {
            lastTransaction = transaction
            return true
          }

          if (!lastTransaction) return true

          if (transaction.steps.length !== 1) return true

          let transactionContent: string | undefined = transaction.steps[0].slice?.content?.toJSON()?.[0].text
          if (!transactionContent) return true

          transactionContent = transactionContent.replace('\n', ' ').replace(/\s/g, '').trim() as string

          const lastTransactionContent = lastTransaction
            .getMeta('task-paste-remove-auto-inserted-line')
            .replace('\n', ' ')
            // replace white space with empty string
            .replace(/\s/g, '')
            .trim() as string

          if (lastTransactionContent.includes(transactionContent)) {
            lastTransaction = null
            return false
          }

          return true
        },
        props: {
          handleDOMEvents: {
            paste: (view, event) => {
              // const htmlContent = event.clipboardData.getData('text/html')
              const textContent = event.clipboardData.getData('text/plain')
              const matches = textContent.matchAll(inputPasteRegex)
              const state = view.state
              const selection = state.selection
              const tr = state.tr

              let count = 0
              const fragments: Fragment[] = []
              for (const match of matches) {
                if (!match || !match.input) continue
                count += 1

                const isChecked = match[0].replace(match[1], '').trim().toLowerCase().includes('[x]')
                const listItem = match[1]

                fragments.push(
                  Fragment.from(
                    state.schema.nodes.task.create(
                      {
                        checked: isChecked,
                      },
                      [state.schema.nodes.paragraph.create(undefined, [state.schema.text(listItem)])],
                    ),
                  ),
                )
              }

              if (count > 0) {
                for (const fragment of fragments.reverse()) {
                  tr.insert(selection.from - 1, fragment)
                }

                tr.setMeta('task-paste-remove-auto-inserted-line', textContent)
                view.dispatch(tr)
                return true
              }

              return false
            },
          },
        },
      }),
    ]
  },
})
