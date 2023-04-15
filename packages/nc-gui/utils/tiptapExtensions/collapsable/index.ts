// Collapsable tiptap node
import { Node, mergeAttributes } from '@tiptap/core'
import type { ChainedCommands, Editor } from '@tiptap/vue-3'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { Slice } from 'prosemirror-model'
import type { EditorState } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'
import CollapsableComponent from './collapsable.vue'

export interface CollapsableOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapsable: {
      insertCollapsable: () => ReturnType
    }
  }
}

export const Collapsable = Node.create<CollapsableOptions>({
  name: 'collapsable',
  priority: 1000,
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content() {
    return 'collapsable_header collapsable_content+'
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="collapsable"]',
        attrs: { 'data-type': 'collapsable' },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': node.type.name,
        'class': 'w-full',
      }),
      0,
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(CollapsableComponent)
  },

  addCommands() {
    return {
      insertCollapsable:
        () =>
        ({ chain, state }: { chain: () => ChainedCommands; state: EditorState }) => {
          return chain()
            .insertContent({
              type: 'collapsable',
              attrs: {
                level: 0,
              },
              content: [
                {
                  type: 'collapsable_header',
                  content: [
                    {
                      type: 'paragraph',
                    },
                  ],
                },
                {
                  type: 'collapsable_content',
                  content: [
                    {
                      type: 'dBlock',
                      content: [
                        {
                          type: 'paragraph',
                        },
                      ],
                    },
                  ],
                },
              ],
            })
            .setTextSelection(state.selection.from + 1)
        },
    } as any
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const editor = this.editor
        const { from, to } = editor.state.selection
        if (from !== to) {
          return false
        }

        if (editor.state.selection.$from.depth < 2) return false

        const parentNode = editor.state.selection.$from.node(editor.state.selection.$from.depth - 2)
        if (parentNode?.type.name !== 'collapsable_content') return false

        const currentTextBlock = editor.state.selection.$from.node(editor.state.selection.$from.depth)
        const currentNodeIndexWrtParent = editor.state.selection.$from.index(editor.state.selection.$from.depth - 2)

        if (
          currentTextBlock?.type.name === 'paragraph' &&
          currentTextBlock.textContent.length === 0 &&
          currentNodeIndexWrtParent === 0 &&
          parentNode.childCount === 1
        ) {
          return editor
            .chain()
            .setTextSelection(from - 5)
            .run()
        }

        if (
          currentTextBlock?.type.name === 'paragraph' &&
          currentTextBlock.textContent.length === 0 &&
          currentNodeIndexWrtParent === 0
        ) {
          return editor
            .chain()
            .setTextSelection(from - 1)
            .run()
        }

        return false
      },
      Enter: () => {
        const editor = this.editor
        const { from, to } = editor.state.selection
        const state = editor.state

        if (from !== to) return false

        if (handleCollapsableHeaderEnter(editor as any)) return true

        // Collapsable content
        if (editor.state.selection.$from.depth < 2) return false

        const parentNode = editor.state.selection.$from.node(editor.state.selection.$from.depth - 2)
        if (parentNode?.type.name !== 'collapsable_content') return false

        const currentDBlockPos = editor.state.selection.$from.before(editor.state.selection.$from.depth - 1)
        const nextDBlockPos = editor.state.selection.$from.after(editor.state.selection.$from.depth - 1)

        const currentTextBlock = editor.state.selection.$from.node(editor.state.selection.$from.depth)
        if (currentTextBlock.textContent.startsWith('/')) return false

        const currentNodeIndexWrtParent = editor.state.selection.$from.index(editor.state.selection.$from.depth - 2)
        if (
          currentTextBlock?.type.name === 'paragraph' &&
          currentTextBlock.textContent.length === 0 &&
          currentNodeIndexWrtParent === parentNode.childCount - 1
        ) {
          editor.view.dispatch(state.tr.delete(currentDBlockPos, nextDBlockPos))
          return true
        }

        const slice = editor.state.doc.slice(currentDBlockPos, from)
        const nextSlice = editor.state.doc.slice(from, nextDBlockPos)

        const newSliceJson = {
          content: [...slice.toJSON().content, ...nextSlice.toJSON().content],
          openStart: 0,
        }

        const newSlice = Slice.fromJSON(state.schema, newSliceJson)

        const tr = state.tr
        tr.replaceRange(currentDBlockPos, nextDBlockPos, newSlice).setSelection(TextSelection.create(tr.doc, from + 4))
        editor.view.dispatch(tr)

        return true
      },
    }
  },
})

function handleCollapsableHeaderEnter(editor: Editor) {
  const { from, to } = editor.state.selection
  const state = editor.state

  if (from !== to) return false

  const parentNode = editor.state.selection.$from.node(editor.state.selection.$from.depth - 1)
  if (editor.state.selection.$from.depth < 2) return false
  if (parentNode?.type.name !== 'collapsable_header') return false

  const currentTextBlock = editor.state.selection.$from.node(editor.state.selection.$from.depth)
  if (currentTextBlock.textContent) return false

  const currentPos = editor.state.selection.$from.before(editor.state.selection.$from.depth)
  const currentNode = state.doc.nodeAt(currentPos)
  const currentNodeIndexWrtParent = editor.state.selection.$from.index(editor.state.selection.$from.depth - 1)
  if (currentNodeIndexWrtParent + 1 === parentNode.childCount && currentNode?.textContent.length === 0) {
    return editor.chain().selectParentNode().deleteSelection().run()
  }

  return false
}
