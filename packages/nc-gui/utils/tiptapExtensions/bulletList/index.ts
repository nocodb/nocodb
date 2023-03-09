import { Node, PasteRule, callOrReturn, mergeAttributes, nodePasteRule, wrappingInputRule } from '@tiptap/core'
import { Fragment, ParseOptions, Node as ProseMirrorNode } from 'prosemirror-model'
import { Plugin, TextSelection } from 'prosemirror-state'
export interface BulletListOptions {
  itemTypeName: string
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bulletList: {
      /**
       * Toggle a bullet list
       */
      toggleBulletList: () => ReturnType
    }
  }
}

const inputPasteRegex = /^\s*([-+*])\s/g
const inputRegex = /^\s*([-+*])\s$/g

export const BulletList = Node.create<BulletListOptions>({
  name: 'bullet',

  addOptions() {
    return {
      HTMLAttributes: {
        'data-type': 'bullet',
      },
    }
  },

  group: 'block',

  content() {
    return 'paragraph'
  },

  parseHTML() {
    return [{ tag: 'div', attrs: { 'data-type': 'bullet' } }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      toggleBulletList:
        () =>
        ({ commands, chain, tr }) => {
          const selection = this.editor.state.selection
          const currentNode = this.editor.state.doc.nodeAt(selection.from - 1)
          const parentNodePos = selection.from - currentNode!.nodeSize
          const parentNode = this.editor.state.doc.nodeAt(parentNodePos)

          const paragraphFragment = Fragment.from(
            this.editor.state.schema.nodes.paragraph.create(undefined, currentNode?.content),
          )
          const bulletNode = this.editor.state.schema.nodes.bullet.create(undefined, paragraphFragment)

          return chain()
            .deleteRange({ from: selection.from - parentNode?.nodeSize, to: selection.from })
            .focus()
            .selectParentNode()
            .command(() => {
              tr.replaceSelectionWith(bulletNode)

              return true
            })
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-2': () => {
        this.editor.chain().focus().setNode('bullet').run()
        return (this.editor.chain().focus() as any).toggleBulletList().run()
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
            .deleteSelection()
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

  addPasteRules() {
    return [
      new PasteRule({
        find: inputPasteRegex,
        handler({ match, chain, range, state }) {
          if (match.input) {
            const actualText = match.input.split('-')[1].trim()
            const fragment = Fragment.from(
              state.schema.nodes.bullet.create(undefined, [
                state.schema.nodes.paragraph.create(undefined, [state.schema.text(actualText)]),
              ]),
            )

            const autoInsertedTextNodePos = range.from + fragment.size

            chain()
              .deleteRange(range)
              .insertContentAt(range.from - 1, fragment.toJSON())
              .setNodeSelection(autoInsertedTextNodePos)
              // todo: this is a hack, we should find a better way to do this
              // For some reason with paste rule getting triggered, the normal
              // text is also being pasted, which causes duplication
              .deleteSelection()
          }
        },
      }),
    ]
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
        props: {
          handleDOMEvents: {
            paste: (view, event) => {
              // const htmlContent = event.clipboardData.getData('text/html')
              // const textContent = event.clipboardData.getData('text/plain')

              // console.log(view.state.doc.toString())

              return false
            },
          },
        },
      }),
    ]
  },
})
