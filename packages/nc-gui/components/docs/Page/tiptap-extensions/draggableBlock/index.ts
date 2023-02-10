import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { Plugin, TextSelection } from 'prosemirror-state'
import DraggableBlockComponent from './draggable-block.vue'

export interface DBlockOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dBlock: {
      /**
       * Toggle a dBlock
       */
      setDBlock: (position?: number) => ReturnType
    }
  }
}

export const DraggableBlock = Node.create<DBlockOptions>({
  name: 'dBlock',

  priority: 1000,

  group: 'dBlock',

  content: 'block',

  draggable: true,

  selectable: false,

  inline: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="d-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'd-block' }), 0]
  },

  onSelectionUpdate(data) {
    // If cursor is inside the node, we make the node focused
    if (!data) return

    const { editor } = data

    focusCurrentDraggableBlock(editor.state)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            drop: (view, event) => {
              const target = event.target as HTMLElement
              const parent = target.parentElement

              if (
                target?.getAttribute('tiptap-draghandle-wrapper') !== 'true' &&
                target?.getAttribute('tiptap-draghandle') !== 'true' &&
                parent?.getAttribute('tiptap-draghandle') !== 'true'
              ) {
                return false
              }

              // Re ordering by default selects the node, so we need to clear the selection
              setTimeout(() => {
                const { state, dispatch } = view
                const { selection } = state
                const { from, to } = selection
                if (from !== to) {
                  dispatch(state.tr.setSelection(TextSelection.create(state.doc, from)))
                }
              }, 0)

              return false
            },
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      setDBlock:
        (position) =>
        ({ state, chain }) => {
          const {
            selection: { from },
          } = state

          const pos = position !== undefined || position !== null ? from : position

          return chain()
            .insertContentAt(pos, {
              type: this.name,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Draggable Block',
                    },
                  ],
                },
              ],
            })
            .focus(pos + 2)
            .run()
        },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(DraggableBlockComponent)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-0': () => this.editor.commands.setDBlock(),
      'Enter': ({ editor }) => {
        const {
          selection: { $head, from, to },
          doc,
        } = editor.state

        const parent = $head.node($head.depth - 1)

        if (parent.type.name !== 'dBlock') return false

        // Skip if suggestion is active
        const activeNodeText: string | undefined = parent.firstChild?.content?.content?.[0]?.text
        if (activeNodeText?.startsWith('/')) return false

        // If active node is the last node in the doc, add a new node
        if (to === doc.nodeSize - 4) {
          console.log('to', to, doc.nodeSize - 4)
          return editor
            .chain()
            .insertContentAt(to, {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: '/',
                },
              ],
            })
            .focus(from + 5)
            .run()
        }

        let currentActiveNodeTo = -1

        doc.descendants((node, pos) => {
          if (currentActiveNodeTo !== -1) return false

          if (node.type.name === this.name) return

          const [nodeFrom, nodeTo] = [pos, pos + node.nodeSize]

          if (nodeFrom <= from && to <= nodeTo) currentActiveNodeTo = nodeTo

          return false
        })

        const nextNode = editor.state.doc.nodeAt(from + 4)
        if (nextNode?.type.name === 'tableRow') {
          return editor
            .chain()
            .focus(from + 6)
            .run()
        }

        return editor
          .chain()
          .focus(from + 4)
          .run()
      },
    }
  },
})

function focusCurrentDraggableBlock(state, nodeIndex: number | null = null) {
  const node = state.doc.nodeAt(state.selection.from)

  if (!node) return

  let totalSize = 0
  if (!nodeIndex) {
    nodeIndex = 0
    for (const rootNode of state.doc.content.content) {
      totalSize += rootNode.nodeSize
      if (totalSize > state.selection.from) {
        break
      }
      nodeIndex++
    }
  }

  const dbBlockDom = document.querySelectorAll('.draggable-block-wrapper')
  for (let i = 0; i < dbBlockDom.length; i++) {
    dbBlockDom[i].classList.remove('focused')
    if (i === nodeIndex) {
      dbBlockDom[i].classList.add('focused')
    }
  }
}
