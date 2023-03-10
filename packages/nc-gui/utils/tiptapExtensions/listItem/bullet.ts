import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import { Fragment, Slice } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import { addPastedContentToTransaction } from './helper'

export interface ListOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bullet: {
      toggleBullet: () => ReturnType
    }
  }
}

const inputPasteRegex = /^\s*([-+*])\s/g
const inputRegex = /^\s*([-+*])\s$/g

let lastTransaction: any = null

export const Bullet = Node.create<ListOptions>({
  name: 'bullet',

  addOptions() {
    return {
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
      }),
      ['div', { class: 'tiptap-list-item-content' }, 0],
    ]
  },

  addCommands() {
    return {
      toggleBullet:
        () =>
        ({ chain, state }) => {
          const { selection } = state

          const topDBlockPos = selection.$from.before(1)

          const bottomDBlockPos = selection.$to.after(1)

          const slice = state.doc.slice(topDBlockPos, bottomDBlockPos)
          const sliceJson = slice.toJSON()

          // Toggle a bullet under `dblock` nodes in slice
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

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-2': () => {
        return (this.editor.chain().focus() as any).toggleBullet().run()
      },
      'Enter': () => {
        const { selection } = this.editor.state

        const parentNode = selection.$from.node(-1)
        if (parentNode.type.name !== 'bullet') return false
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
                type: 'bullet',
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
          if (transaction.getMeta('bullet-paste-remove-auto-inserted-line')) {
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

          const lastTransactionContent = (lastTransaction.getMeta('bullet-paste-remove-auto-inserted-line') as string)
            .replace('\n', ' ')
            .split('-')
            .map((item, index) => (index === 0 ? item : item.trim()))
            .join()

          if (lastTransactionContent.trim().includes(transactionContent.trim())) {
            lastTransaction = null
            return false
          }

          return true
        },
        props: {
          handleDOMEvents: {
            paste: (view, event) => {
              // const htmlContent = event.clipboardData.getData('text/html')
              const textContent = event.clipboardData?.getData('text/plain')
              if (!textContent) return false

              const matches = textContent.matchAll(inputPasteRegex)
              const state = view.state
              const tr = state.tr

              let found = false

              const fragments = []
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

                  fragments.push(fragment)
                }
              }

              if (found) {
                addPastedContentToTransaction(tr, state, fragments.reverse())

                tr.setMeta('bullet-paste-remove-auto-inserted-line', textContent)

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
