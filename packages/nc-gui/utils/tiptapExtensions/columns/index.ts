import { Node, mergeAttributes } from '@tiptap/core'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { NodeSelection, Plugin } from 'prosemirror-state'
import { Slice } from 'prosemirror-model'
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    column: {
      insertColumn: (colCount: number) => ReturnType
    }
  }
}

export const ColumnNode = Node.create({
  name: TiptapNodesTypes.column,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'column items-baseline flex flex-row',
      },
    }
  },
  content: `${TiptapNodesTypes.columnContent}+`,

  group: 'block',

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column' }), 0]
  },

  addCommands() {
    return {
      insertColumn:
        (colCount) =>
        ({ chain, state }) => {
          return chain()
            .insertContent({
              type: TiptapNodesTypes.column,
              content: Array(colCount).fill({
                type: TiptapNodesTypes.columnContent,
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
              }),
            })
            .setTextSelection(state.selection.from + 2)
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        // Automatically remove column toggle if its a single column
        // And insert the sections inside the column instead
        appendTransaction: (__, _, state) => {
          let columnWithOneContentPos = -1
          state.doc.descendants((node, pos) => {
            if (nodeTypesContainingSection.includes(node.type.name as TiptapNodesTypes)) {
              if (node.type.name === TiptapNodesTypes.column) {
                if (node.content.childCount === 1) {
                  columnWithOneContentPos = pos
                }
                return false
              }

              return true
            }
          })
          if (columnWithOneContentPos === -1) return null

          const columnNode = state.doc.nodeAt(columnWithOneContentPos)
          if (!columnNode) return null

          const sectionPos = getPositionOfSection(state, columnWithOneContentPos)
          const sectionNode = state.doc.nodeAt(sectionPos)
          if (!sectionNode) return null

          const columnNodeJson = columnNode.toJSON()
          const newSliceJson = {
            content: <any>[],
          }
          for (const columnSectionNode of columnNodeJson.content) {
            for (const sectionNode of columnSectionNode.content) {
              newSliceJson.content.push(sectionNode)
            }
          }

          return state.tr
            .setSelection(NodeSelection.create(state.doc, sectionPos))
            .deleteSelection()
            .insert(sectionPos, Slice.fromJSON(state.schema, newSliceJson).content)
        },
      }),
    ]
  },
})
