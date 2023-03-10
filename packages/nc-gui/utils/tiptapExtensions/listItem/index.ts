import { Node, PasteRule, callOrReturn, mergeAttributes, nodePasteRule, wrappingInputRule } from '@tiptap/core'
import { Fragment, ParseOptions, Node as ProseMirrorNode, Slice } from 'prosemirror-model'
import { NodeSelection, Plugin, TextSelection } from 'prosemirror-state'
export interface ListOptions {
  type: 'bullet' | 'ordered' | 'task'
  value: string
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    listItem: {
      /**
       * Toggle a list item
       */
      insertBulletList: () => ReturnType
      toggleListItem: (type: string) => ReturnType
    }
  }
}

const inputPasteRegex = /^\s*([-+*])\s/g
const inputRegex = /^\s*([-+*])\s$/g

let lastTransaction: any = null

export const ListItem = Node.create<ListOptions>({
  name: 'listItem',

  addOptions() {
    return {
      type: 'bullet',
      content: '',
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content() {
    return 'paragraph'
  },

  addAttributes() {
    return {
      type: {
        default: null,
        parseHTML: (element) => {
          const type = element.getAttribute('data-sub-type')

          return type || 'bullet'
        },
      },
      value: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute('data-value')

          return value || ''
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div', attrs: { 'data-type': this.name } }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': node.type.name,
        'data-sub-type': node.attrs.type,
        'data-value': node.attrs.value,
      }),
      [
        'div',
        {
          class: 'tiptap-list-item-start',
        },
        [
          'span',
          {
            'data-value': node.attrs.value,
          },
        ],
      ],
      ['div', { class: 'tiptap-list-item-content' }, 0],
    ]
  },

  addCommands() {
    return {
      insertBulletList:
        () =>
        ({ chain, tr }) => {
          const selection = this.editor.state.selection
          const currentNode = this.editor.state.doc.nodeAt(selection.from - 1)
          const parentNodePos = selection.from - currentNode!.nodeSize
          const parentNode = this.editor.state.doc.nodeAt(parentNodePos)

          const paragraphFragment = Fragment.from(
            this.editor.state.schema.nodes.paragraph.create(undefined, currentNode?.content),
          )
          const bulletNode = this.editor.state.schema.nodes.bullet.create(undefined, paragraphFragment)

          return chain()
            .deleteRange({ from: selection.from - parentNode!.nodeSize, to: selection.from })
            .focus()
            .selectParentNode()
            .command(() => {
              tr.replaceSelectionWith(bulletNode)

              return true
            })
        },
      toggleListItem:
        (type: string) =>
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
                if (child.type !== this.name) {
                  child.content = [structuredClone(child)]
                  child.type = this.name
                  child.attrs = {
                    value: String(prevOrderedListNodeNumber + 1),
                    type,
                  }
                  prevOrderedListNodeNumber = prevOrderedListNodeNumber + 1
                } else if (child.attrs?.type !== type) {
                  child.attrs = {
                    value: String(prevOrderedListNodeNumber + 1),
                    type,
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
      'Ctrl-Alt-2': () => {
        this.editor.chain().focus().setNode('listItem').run()
        return (this.editor.chain().focus() as any).toggleListItem().run()
      },
      'Enter': () => {
        const { selection } = this.editor.state

        const parentNode = selection.$from.node(-1)
        if (parentNode.type.name !== 'listItem') return false
        const currentNode = selection.$from.node()

        // Delete the bullet point if it's empty
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

        // We check if cursor at the end of the bullet point
        const isEndOfBullet = currentNodeEndPos === selection.to

        const sliceToBeMoved = this.editor.state.doc.slice(from, currentNodeEndPos)

        const sliceToBeMovedContent = !isEndOfBullet
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
                type: 'listItem',
                attrs: {
                  type: parentNode.attrs.type,
                  value: parentNode.attrs.type === 'ordered' ? Number(parentNode.attrs.value) + 1 : '',
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
            if (isEndOfBullet) {
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
          return {
            type: 'bullet',
          }
        },
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
          if (transaction.getMeta('paste-remove-auto-inserted-line')) {
            lastTransaction = transaction
            return true
          }

          if (!lastTransaction) return true

          if (transaction.steps.length !== 1) return true

          let transactionContent: string | undefined = transaction.steps[0].slice?.content?.toJSON()?.[0].text
          if (!transactionContent) return true

          transactionContent = transactionContent.replace('\n', ' ')
          transactionContent = transactionContent
            .split('-')
            .map((item, index) => (index === 0 ? item : item.trim()))
            .join()

          const lastTransactionContent = (lastTransaction.getMeta('paste-remove-auto-inserted-line') as string)
            .replace('\n', ' ')
            .split('-')
            .map((item, index) => (index === 0 ? item : item.trim()))
            .join()

          if (transactionContent === lastTransactionContent) {
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

              let found = false

              for (const match of matches) {
                if (!match || !match.input) continue

                const listItems = match.input
                  .split('\n')
                  .map((item) => item.split('-')[1].trim())
                  .reverse()

                for (const listItem of listItems) {
                  found = true
                  const fragment = Fragment.from(
                    state.schema.nodes.bullet.create(undefined, [
                      state.schema.nodes.paragraph.create(undefined, [state.schema.text(listItem)]),
                    ]),
                  )

                  tr.insert(selection.from - 1, fragment)
                }
              }

              if (found) {
                tr.setMeta('paste-remove-auto-inserted-line', textContent)
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
