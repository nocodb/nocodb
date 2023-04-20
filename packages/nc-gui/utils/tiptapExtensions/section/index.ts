import { Node, mergeAttributes } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { Plugin, TextSelection } from 'prosemirror-state'
import { indexOfChildNode, positionOfFirstChild } from '../helper'
import DraggableSectionComponent from './draggable-section.vue'
import { getPositionOfNextSection, getPositionOfSection } from './helpers'

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
      selectActiveSectionFirstChild: () => ReturnType
      /**
       *
       * Select next section
       * @param sectionPosition - Position of the section to select else, section position is calculated from the cursor position
       *
       **/
      selectNextSection: (sectionPosition?: number) => ReturnType
    }
  }
}

export const SectionBlock = Node.create<SecOptions>({
  name: 'sec',

  priority: 1000,

  group: 'sec',

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
    return [{ tag: 'div[data-type="sec"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'sec' }), 0]
  },

  onSelectionUpdate() {
    // If cursor is inside the section node, we make the node focused
    const { state } = this.editor

    focusCurrentSection(state)

    return false
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
          const currentSectionPos = state.selection.$from.before(1)
          const currentSectionNode = state.doc.nodeAt(currentSectionPos)
          const currentSectionRange = {
            from: currentSectionPos,
            to: currentSectionPos + currentSectionNode!.nodeSize,
          }

          return commands.deleteRange(currentSectionRange)
        },
      selectActiveSectionFirstChild:
        () =>
        ({ state, commands }) => {
          const currentSectionPos = getPositionOfSection(state)
          if (!currentSectionPos) return false

          const currentSectionFirstChildPos = positionOfFirstChild(state, currentSectionPos, 'start')
          if (!currentSectionFirstChildPos) return false

          return commands.setTextSelection(currentSectionFirstChildPos)
        },
      selectNextSection:
        (sectionPosition) =>
        ({ state, commands }) => {
          const nextSectionPos = getPositionOfNextSection(state, sectionPosition)
          if (!nextSectionPos) return false

          return commands.setTextSelection(nextSectionPos)
        },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(DraggableSectionComponent)
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (handleForQuoteAndCodeNode(editor as any)) return true

        return false
      },
    }
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
  const selection = state.selection
  let activeNodeIndex = 0
  let found = false

  state.doc.descendants((node, pos) => {
    if (node.type.name === 'collapsable' || node.type.name === 'collapsable_content') {
      return true
    }

    if (found || node.type.name !== 'sec') return false

    if (pos > selection.from) {
      found = true
      return false
    }

    activeNodeIndex = activeNodeIndex + 1

    return true
  })

  const dbBlockDoms = document.querySelectorAll('.draggable-block-wrapper')
  for (let i = 0; i < dbBlockDoms.length; i++) {
    dbBlockDoms[i].classList.remove('focused')

    if (i === activeNodeIndex - 1) {
      dbBlockDoms[i].classList.add('focused')
    }
  }
}

function handleForQuoteAndCodeNode(editor: Editor) {
  const state = editor.state
  const { from, to } = editor.state.selection

  if (from !== to) return false

  const parentNode = state.selection.$from.node(-1)
  const currentNode = state.selection.$from.node()

  const parentType = parentNode?.type.name
  const currentNodeType = currentNode?.type.name

  if (currentNodeType === 'codeBlock') {
    return handleCodeblockLastLineEnter(editor)
  }

  if (parentType === 'blockquote') {
    return handleBlockquote(editor)
  }

  return false
}

function handleBlockquote(editor: Editor) {
  const state = editor.state

  const currentNode = state.selection.$from.node()

  if (currentNode?.textContent?.length !== 0) {
    editor.chain().insertContentAt(state.selection.$from.pos, { type: 'paragraph', text: '\n' }).run()
    return true
  }

  editor
    .chain()
    .setTextSelection({ from: state.selection.$from.pos - 1, to: state.selection.$from.pos })
    .deleteSelection()
    .run()

  return true
}

function handleCodeblockLastLineEnter(editor: Editor) {
  const { from, to } = editor.state.selection

  if (from !== to) return false

  const currentNode = editor.state.selection.$from.node()
  if (currentNode?.type.name !== 'codeBlock') return false

  const nextNodePos = editor.state.selection.$from.pos + 2
  const nextNode = editor.state.doc.nodeAt(nextNodePos)

  if (currentNode.textContent.length === 0) {
    editor.chain().insertContentAt(editor.state.selection.$from.pos, { text: '\n' }).run()
    return true
  }

  if (currentNode.textContent[currentNode.textContent.length - 1] !== '\n') return false
  if (nextNode?.type.name !== 'sec') return false

  editor
    .chain()
    .setTextSelection({ from: from - 1, to: from })
    .deleteSelection()
    .focus(nextNodePos + 1)
    .run()
  return true
}
