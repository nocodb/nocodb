import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { Plugin } from 'prosemirror-state'
import { Slice } from 'prosemirror-model'
import { getPositionOfSection } from '../helper'
import ColumnContent from './column-content.vue'

export const ColumnContentNode = Node.create({
  name: TiptapNodesTypes.columnContent,

  addAttributes() {
    return {
      widthPercent: {
        default: 50,
        parseHTML: (element) => {
          const colwidth = element.getAttribute('widthPercent')
          const value = colwidth ? [parseInt(colwidth, 10)] : null

          return value
        },
      },
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'flex column-content items-baseline',
      },
    }
  },
  content: 'sec+',

  group: 'block',

  parseHTML() {
    return [{ tag: 'div[data-type="column-content"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column-content' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(ColumnContent)
  },

  addKeyboardShortcuts() {
    return {
      // Pressing arrow down on the last section of any column content
      // should select the next section outside of the column instead of next section inside the column
      ArrowDown: () => {
        const state = this.editor.state
        const selection = state.selection

        // Minimum depth of the selection should be 5, which is minimum for a column section
        if (selection.$from.depth < 5) return false

        const contentNode = state.selection.$from.node(-2)
        if (contentNode.type.name !== TiptapNodesTypes.columnContent) return false

        // Verify that the current section is the last child of the column content
        const sectionPos = getPositionOfSection(state)
        const sectionResolvedPos = state.doc.resolve(sectionPos)

        if (sectionResolvedPos.parent.childCount - 1 !== sectionResolvedPos.index()) return false

        // The parent section which contains the column wrapper
        const sectionOfColumnPos = sectionResolvedPos.before(-2)
        const sectionOfColumn = state.doc.nodeAt(sectionOfColumnPos)
        if (!sectionOfColumn) return false

        return this.editor
          .chain()
          .setTextSelection(sectionOfColumnPos + sectionOfColumn?.nodeSize + 2)
          .run()
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _, newState) => {
          try {
            if (transactions.length !== 1) return null

            const transaction = transactions[0]
            if (transaction.steps.length !== 1) return null

            const step = transaction.steps[0]
            const stepJson = step.toJSON()
            if (!stepJson.slice || stepJson.stepType !== 'replace') return null

            const sectionPos = getPositionOfSection(newState)
            const section = newState.doc.nodeAt(sectionPos)
            const columnContent = newState.doc.resolve(sectionPos).parent
            if (columnContent?.type.name !== TiptapNodesTypes.columnContent) return null

            const sectionPosIndex = newState.doc.resolve(sectionPos).index()

            if (sectionPosIndex !== columnContent.childCount - 1) return null

            const endOfCurrentSectionPos = sectionPos + section!.nodeSize - 1

            const fragment = Slice.fromJSON(newState.schema, {
              type: TiptapNodesTypes.sec,
              content: [
                {
                  type: TiptapNodesTypes.paragraph,
                },
              ],
            }).content

            return newState.tr.insert(endOfCurrentSectionPos, fragment)
          } catch (error) {
            console.error(error)
            return null
          }
        },
      }),
    ]
  },
})
