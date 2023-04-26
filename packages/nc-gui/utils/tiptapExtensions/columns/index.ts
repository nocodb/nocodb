import { Node, mergeAttributes } from '@tiptap/core'
import { TiptapNodesTypes } from 'nocodb-sdk'

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
        ({ commands }) => {
          return commands.insertContent({
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
        },
    }
  },
})
