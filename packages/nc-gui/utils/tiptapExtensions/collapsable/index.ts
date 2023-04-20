// Collapsable tiptap node
import { Node, mergeAttributes } from '@tiptap/core'
import type { ChainedCommands } from '@tiptap/vue-3'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { getPosOfChildNodeOfType, getPositionOfSection, isCursorAtStartOfSelectedNode } from '../helper'
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
          isCursorAtStartOfSelectedNode(state) &&
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
    }
  },
})
