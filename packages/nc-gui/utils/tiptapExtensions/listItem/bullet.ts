import { Node, mergeAttributes, nodePasteRule, wrappingInputRule } from '@tiptap/core'
import { Fragment, Slice } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import { addPastedContentToTransaction, getTextAsParagraphFromSliceJson } from './helper'

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
                  child.content = [getTextAsParagraphFromSliceJson(child)]
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
})
