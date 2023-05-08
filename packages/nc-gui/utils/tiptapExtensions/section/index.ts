import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import type { EditorState } from 'prosemirror-state'
import { Plugin, TextSelection } from 'prosemirror-state'
import {
  getPositionOfNextSection,
  getPositionOfPreviousSection,
  getPositionOfSection,
  nonTextLeafNodes,
  positionOfFirstChild,
} from '../helper'
import DraggableSectionComponent from './draggable-section.vue'
import { selectSectionsInTextSelection } from './helper'

export interface SecOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sec: {
      /**
       * Delete section which has the cursor
       */
      deleteActiveSection: () => ReturnType
      /**
       * Select section which has the cursor
       */
      selectActiveSectionFirstChild: (pos?: number) => ReturnType
      /**
       *
       * Select next section
       * @param sectionPosition - Position of the section to select else, section position is calculated from the cursor position
       *
       **/
      selectNextSection: (sectionPosition?: number) => ReturnType
      /**
       *
       * Select prev section
       * @param sectionPosition - Position of the section to select else, section position is calculated from the cursor position
       *
       **/
      selectPrevSection: (sectionPosition?: number) => ReturnType
    }
  }
}

export const SectionBlock = Node.create<SecOptions>({
  name: TiptapNodesTypes.sec,

  priority: 1000,

  group: 'sec',

  content: 'block',

  addAttributes() {
    return {
      isInsertedHistory: {
        default: false,
        parseHTML: (element) => {
          return element.getAttribute('data-diff-node') === 'ins'
        },
      },
      isDeletedHistory: {
        default: false,
        parseHTML: (element) => {
          return element.getAttribute('data-diff-node') === 'del'
        },
      },
    }
  },

  draggable: true,

  selectable: false,

  inline: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="sec"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'sec' }), 0]
  },

  onSelectionUpdate() {
    // If cursor is inside the section node, we make the node focused
    const { state } = this.editor

    focusCurrentSection(state)
    selectSectionsInTextSelection(state)

    return false
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const state = this.editor.state
        const { selection } = state
        if (selection.empty) return false

        const from = selection.$from.pos === 2 ? 0 : selection.$from.pos
        const to = selection.$to.pos

        const fromNode = state.doc.nodeAt(from)!
        const toNode = state.doc.nodeAt(to)!
        if (!fromNode || !toNode) return false

        if (fromNode.type.name !== TiptapNodesTypes.sec || toNode.type.name !== TiptapNodesTypes.sec) {
          return false
        }

        // Delete the sections
        this.editor
          .chain()
          .deleteRange({ from, to })
          .setTextSelection(from + 2)
          .run()

        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            drop: (view, event) => {
              if (!event.dataTransfer?.getData('text/html').includes('data-type="sec"')) {
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
      deleteActiveSection:
        () =>
        ({ state, commands }) => {
          const currentSectionPos = getPositionOfSection(state)
          const currentSectionNode = state.doc.nodeAt(currentSectionPos)
          const currentSectionRange = {
            from: currentSectionPos,
            to: currentSectionPos + currentSectionNode!.nodeSize,
          }

          return commands.deleteRange(currentSectionRange)
        },
      selectActiveSectionFirstChild:
        (pos?: number) =>
        ({ state, commands }) => {
          const currentSectionPos = getPositionOfSection(state, pos)
          if (!currentSectionPos) return false

          const currentSectionFirstChildPos = positionOfFirstChild(state, currentSectionPos, 'start')
          if (!currentSectionFirstChildPos) return false

          const currentSectionFirstChildNode = state.doc.nodeAt(currentSectionFirstChildPos)!
          if (nonTextLeafNodes.includes(currentSectionFirstChildNode.type.name as TiptapNodesTypes)) {
            return commands.setNodeSelection(currentSectionPos)
          }

          return commands.setTextSelection(currentSectionFirstChildPos + 1)
        },
      selectNextSection:
        (sectionPosition) =>
        ({ state, commands }) => {
          const nextSectionPos = getPositionOfNextSection(state, sectionPosition)
          if (!nextSectionPos) return false

          const nextSectionFirstChildPos = positionOfFirstChild(state, nextSectionPos, 'start')
          if (!nextSectionFirstChildPos) return false

          const nextSectionFirstChildNode = state.doc.nodeAt(nextSectionFirstChildPos)!

          if (nonTextLeafNodes.includes(nextSectionFirstChildNode.type.name as TiptapNodesTypes)) {
            return commands.setNodeSelection(nextSectionFirstChildPos)
          }

          return commands.setTextSelection(nextSectionPos + 1)
        },
      selectPrevSection:
        (sectionPosition) =>
        ({ state, commands }) => {
          const prevSectionPos = getPositionOfPreviousSection(state, sectionPosition)
          if (!prevSectionPos) return false

          const prevSectionFirstChildPos = positionOfFirstChild(state, prevSectionPos, 'start')
          if (!prevSectionFirstChildPos) return false

          const prevSectionFirstChildNode = state.doc.nodeAt(prevSectionFirstChildPos)!

          if (nonTextLeafNodes.includes(prevSectionFirstChildNode.type.name as TiptapNodesTypes)) {
            return commands.setNodeSelection(prevSectionFirstChildPos)
          }

          return commands.setTextSelection(prevSectionFirstChildPos + 1)
        },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(DraggableSectionComponent)
  },
})

/**
 * Find the selected section including sections inside collapsable and collapsable_content
 * And add class to it
 *
 * Reason we are doing this rather doing this logic in 'section' vue component is
 * It will be complicated to only selected the correct section in the case of collapsable
 */
function focusCurrentSection(state: EditorState) {
  const selectedNode = state.doc.nodeAt(state.selection.from)
  const secPos = selectedNode?.type.name === TiptapNodesTypes.sec ? state.selection.from : getPositionOfSection(state)
  const secDom = document.querySelector(`[tiptap-draghandle-wrapper="true"][pos="${secPos}"]`) as HTMLElement

  const dbBlockDoms = document.querySelectorAll('.draggable-block-wrapper')
  for (let i = 0; i < dbBlockDoms.length; i++) {
    dbBlockDoms[i].classList.remove('focused')
  }

  // TODO: We need to wait for the dom to be rendered
  setTimeout(() => {
    secDom?.parentElement?.classList.add('focused')
  }, 150)
}
