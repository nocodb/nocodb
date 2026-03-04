/**
 * 2-Column layout extension for the doc editor.
 *
 * Renders two side-by-side columns using CSS Grid. Each column accepts
 * any block content (paragraphs, headings, lists, callouts, code, etc.).
 *
 * Two ProseMirror node types:
 *   columns — top-level wrapper (exactly 2 children)
 *   column  — individual column (content: block+)
 *
 * No NodeView — follows the CalloutExtension CSS-only pattern
 * (renderHTML with content holes) to avoid decoration conflicts
 * with the table plugin's CellSelection.
 *
 * Stored in ProseMirror doc as:
 *   { type: 'columns', content: [
 *     { type: 'column', content: [...] },
 *     { type: 'column', content: [...] },
 *   ]}
 */
import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: () => ReturnType
      unsetColumns: () => ReturnType
    }
  }
}

export const DocColumnsExtension = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column column',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-columns]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'nc-columns', 'data-columns': '' }), 0]
  },

  addCommands() {
    return {
      setColumns:
        () =>
        ({ state, chain }) => {
          // Prevent nesting — bail if cursor is inside a column node
          const { $from } = state.selection
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'column') return false
          }

          return chain()
            .insertContent({
              type: 'columns',
              content: [
                { type: 'column', content: [{ type: 'paragraph' }] },
                { type: 'column', content: [{ type: 'paragraph' }] },
              ],
            })
            .run()
        },

      unsetColumns:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection

          // Find the columns node in the ancestor chain
          let columnsPos = -1
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'columns') {
              columnsPos = $from.before(d)
              break
            }
          }
          if (columnsPos < 0) return false

          const columnsNode = state.doc.nodeAt(columnsPos)
          if (!columnsNode) return false

          if (dispatch) {
            // Collect all content from both columns
            const content: any[] = []
            columnsNode.forEach((column) => {
              column.forEach((child) => {
                content.push(child)
              })
            })

            // Replace the columns node with the collected content
            tr.replaceWith(columnsPos, columnsPos + columnsNode.nodeSize, content)
            dispatch(tr)
          }

          return true
        },
    }
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderContent(node)
        },
      },
    }
  },
})

export const DocColumnExtension = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-column]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'nc-column', 'data-column': '' }), 0]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderContent(node)
        },
      },
    }
  },
})
