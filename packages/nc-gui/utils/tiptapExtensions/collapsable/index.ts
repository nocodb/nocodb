// Collapsable tiptap node
import { Node, mergeAttributes } from '@tiptap/core'
import type { ChainedCommands, Editor } from '@tiptap/vue-3'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { Slice } from 'prosemirror-model'
import type { EditorState } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'
import { getPosOfChildNodeOfType, isCursorAtStartOfParagraph } from '../helper'
import { getPositionOfSection } from '../section/helpers'
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
                      type: 'sec',
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
      'Ctrl-Alt-4': () => this.editor.commands.insertCollapsable(),
      'Backspace': () => {
        const editor = this.editor
        const state = editor.state
        if (!state.selection.empty) return false

        // Verify if the cursor is in a collapsable node
        if (editor.state.selection.$from.depth < 3) return false

        const collapsableContentPos = state.selection.$from.before(editor.state.selection.$from.depth - 2)
        const collapsableContentNode = editor.state.doc.nodeAt(collapsableContentPos)

        if (collapsableContentNode?.type.name !== 'collapsable_content') return false

        // Handle the case when the cursor is at the beginning of the collapsable content and backspace is pressed
        // Should move the cursor to the end of the collapsable header
        const currentParagraphNodeIndexWrtParent = editor.state.selection.$from.index(editor.state.selection.$from.depth - 2)

        if (
          isCursorAtStartOfParagraph(state) &&
          currentParagraphNodeIndexWrtParent === 0 &&
          collapsableContentNode.childCount === 1
        ) {
          const parentSection = getPositionOfSection(state, collapsableContentPos)!
          const collapseHeaderPos = getPosOfChildNodeOfType({
            state: editor.state,
            nodeType: 'collapsable_header',
            nodePos: parentSection,
          })!

          const collapseHeaderNode = editor.state.doc.nodeAt(collapseHeaderPos)!

          const collapsableHeaderEndPos = collapseHeaderPos + collapseHeaderNode.nodeSize - 1

          return editor.chain().setTextSelection(collapsableHeaderEndPos).run()
        }

        return false
      },
      'Enter': () => {
        const editor = this.editor
        const state = editor.state
        const selection = state.selection

        if (!selection.empty) return false

        if (handleCollapsableHeaderEnter(editor as any)) return true

        // Collapsable content
        if (selection.$from.depth < 2) return false

        const parentNode = selection.$from.node(selection.$from.depth - 2)
        if (parentNode?.type.name !== 'collapsable_content') return false

        const currentSecPos = selection.$from.before(selection.$from.depth - 1)
        const nextSecPos = selection.$from.after(selection.$from.depth - 1)

        const currentTextBlock = selection.$from.node(selection.$from.depth)
        if (currentTextBlock.textContent.startsWith('/')) return false

        const currentNodeIndexWrtParent = selection.$from.index(selection.$from.depth - 2)
        if (
          currentTextBlock?.type.name === 'paragraph' &&
          currentTextBlock.textContent.length === 0 &&
          currentNodeIndexWrtParent === parentNode.childCount - 1
        ) {
          editor.view.dispatch(state.tr.delete(currentSecPos, nextSecPos))
          return true
        }

        const slice = state.doc.slice(currentSecPos, selection.from)
        const nextSlice = state.doc.slice(selection.from, nextSecPos)

        const newSliceJson = {
          content: [...slice.toJSON().content, ...nextSlice.toJSON().content],
          openStart: 0,
        }

        const newSlice = Slice.fromJSON(state.schema, newSliceJson)

        const tr = state.tr
        tr.replaceRange(currentSecPos, nextSecPos, newSlice).setSelection(TextSelection.create(tr.doc, selection.from + 4))
        editor.view.dispatch(tr)

        return true
      },
    }
  },
})

function handleCollapsableHeaderEnter(editor: Editor) {
  const state = editor.state

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
