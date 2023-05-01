// Collapsable tiptap node
import { Node, mergeAttributes } from '@tiptap/core'
import type { ChainedCommands } from '@tiptap/vue-3'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { getPosOfChildNodeOfType, getPositionOfSection, isCursorAtStartOfSelectedNode } from '../helper'
import CollapsableComponent from './collapsable.vue'

export interface CollapsableOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapsable: {
      insertCollapsable: () => ReturnType
      insertCollapsableH1: () => ReturnType
      insertCollapsableH2: () => ReturnType
      insertCollapsableH3: () => ReturnType
    }
  }
}

export const CollapsableNode = Node.create<CollapsableOptions>({
  name: TiptapNodesTypes.collapsable,
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
          return insertCollapsable({
            chain,
            state,
          })
        },
      insertCollapsableH1:
        () =>
        ({ chain, state }: { chain: () => ChainedCommands; state: EditorState }) => {
          return insertCollapsable({
            chain,
            state,
            headerContent: [
              {
                type: TiptapNodesTypes.heading,
                attrs: {
                  level: 1,
                },
              },
            ],
          })
        },
      insertCollapsableH2:
        () =>
        ({ chain, state }: { chain: () => ChainedCommands; state: EditorState }) => {
          return insertCollapsable({
            chain,
            state,
            headerContent: [
              {
                type: TiptapNodesTypes.heading,
                attrs: {
                  level: 2,
                },
              },
            ],
          })
        },
      insertCollapsableH3:
        () =>
        ({ chain, state }: { chain: () => ChainedCommands; state: EditorState }) => {
          return insertCollapsable({
            chain,
            state,
            headerContent: [
              {
                type: TiptapNodesTypes.heading,
                attrs: {
                  level: 3,
                },
              },
            ],
          })
        },
    } as any
  },

  addKeyboardShortcuts() {
    return {
      'Ctrl-Alt-4': () => this.editor.commands.insertCollapsable(),
      // Select next collapsable content node if
      'Enter': () => {
        const editor = this.editor
        const state = editor.state
        if (!state.selection.empty) return false

        const collapsableHeaderPos = state.selection.$from.before(editor.state.selection.$from.depth - 1)
        const collapsablePos = collapsableHeaderPos - 1
        const collapsableHeaderNode = editor.state.doc.nodeAt(collapsableHeaderPos)

        if (collapsableHeaderNode?.type.name !== TiptapNodesTypes.collapsableHeader) return false

        const collapsableDom = document.querySelector(`.ProseMirror [collapsable-pos="${collapsablePos}"]`)
        const isCollapsed = collapsableDom?.classList.contains('collapsed')

        // If the collapsable is collapsed, select the next visible section, not the first child of the collapsable which is also a section
        if (isCollapsed) {
          const nextSectionPos = collapsablePos + state.doc.nodeAt(collapsablePos)!.nodeSize + 1
          const nextSectionFirstChildPos = nextSectionPos + 1
          return editor
            .chain()
            .setTextSelection(nextSectionFirstChildPos + 1)
            .run()
        }

        // If the collapsable is not collapsed, select the first child of the collapsable which is also a section
        const sliceFromCursorToCollapsableHeaderEnd = state.doc.slice(
          state.selection.$from.pos,
          collapsableHeaderPos + collapsableHeaderNode.nodeSize - 1,
        )

        const collapsableContentPos = collapsableHeaderPos + collapsableHeaderNode.nodeSize

        const sliceFromCursorToCollapsableHeaderEndContent =
          sliceFromCursorToCollapsableHeaderEnd?.toJSON()?.content?.map((node: any) => {
            if (node.type === TiptapNodesTypes.heading) {
              return {
                type: TiptapNodesTypes.paragraph,
                content: node.content,
              }
            }
            return node
          }) ?? []

        const sliceFromCursorToCollapsableHeaderEndJson = {
          type: TiptapNodesTypes.collapsableContent,
          content: [
            {
              type: TiptapNodesTypes.sec,
              content: sliceFromCursorToCollapsableHeaderEndContent,
            },
          ],
        }

        return (
          editor
            .chain()
            .insertContentAt(collapsableContentPos, sliceFromCursorToCollapsableHeaderEndJson)
            .deleteRange({
              from: state.selection.$from.pos,
              to: collapsableHeaderPos + collapsableHeaderNode.nodeSize - 1,
            })
            // TODO: Remove magic number. Is tricky as content changes due to insertContentAt
            .setTextSelection(collapsableContentPos + 3)
            .run()
        )
      },
      'Backspace': () => {
        const editor = this.editor
        const state = editor.state
        if (!state.selection.empty) return false

        // Verify if the cursor is in a collapsable node
        if (editor.state.selection.$from.depth < 3) return false

        const collapsableContentPos = state.selection.$from.before(editor.state.selection.$from.depth - 2)
        const collapsableContentNode = editor.state.doc.nodeAt(collapsableContentPos)

        if (collapsableContentNode?.type.name !== TiptapNodesTypes.collapsableContent) return false

        // Handle the case when the cursor is at the beginning of the collapsable content and backspace is pressed
        // Should move the cursor to the end of the collapsable header
        const currentParagraphNodeIndexWrtParent = editor.state.selection.$from.index(editor.state.selection.$from.depth - 2)

        if (isCursorAtStartOfSelectedNode(state) && currentParagraphNodeIndexWrtParent === 0) {
          const parentSection = getPositionOfSection(state, collapsableContentPos)!
          const collapseHeaderPos = getPosOfChildNodeOfType({
            state: editor.state,
            nodeType: TiptapNodesTypes.collapsableHeader,
            nodePos: parentSection,
          })!

          const collapseHeaderNode = editor.state.doc.nodeAt(collapseHeaderPos)!

          const collapsableHeaderEndPos = collapseHeaderPos + collapseHeaderNode.nodeSize - 1

          console.log('collapsableHeaderEndPos', collapsableHeaderEndPos)
          return editor
            .chain()
            .setTextSelection(collapsableHeaderEndPos - 1)
            .run()
        }

        return false
      },
    }
  },
})

function insertCollapsable({
  chain,
  state,
  headerContent,
}: {
  chain: () => ChainedCommands
  state: EditorState
  headerContent?: any
}) {
  return chain()
    .insertContent({
      type: TiptapNodesTypes.collapsable,
      content: [
        {
          type: TiptapNodesTypes.collapsableHeader,
          content: headerContent ?? [
            {
              type: TiptapNodesTypes.paragraph,
            },
          ],
        },
        {
          type: TiptapNodesTypes.collapsableContent,
          content: [
            {
              type: TiptapNodesTypes.sec,
              content: [
                {
                  type: TiptapNodesTypes.paragraph,
                },
              ],
            },
          ],
        },
      ],
    })
    .setTextSelection(state.selection.from + 1)
}
