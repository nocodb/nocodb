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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _, newState) => {
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
        },
      }),
    ]
  },
})
