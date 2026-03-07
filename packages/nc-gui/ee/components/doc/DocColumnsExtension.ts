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

// --- Column ratio ---
//
// Stored as a number: the left column's width percentage (15–85).
// CSS is generated as `${ratio}% ${100-ratio}%`.
// Toolbar presets are a convenience — the attribute accepts any value
// in the valid range, so a future drag-to-resize can set arbitrary values.

/** Minimum / maximum left column percentage */
export const COL_RATIO_MIN = 15
export const COL_RATIO_MAX = 85
export const COL_RATIO_DEFAULT = 50

/** Preset ratios shown in the toolbar (left column %) */
export const COLUMN_RATIO_PRESETS = [50, 33, 67, 25, 75] as const
export type ColumnRatioPreset = (typeof COLUMN_RATIO_PRESETS)[number]

/** Clamp a ratio to the valid range */
export function clampRatio(value: number): number {
  return Math.max(COL_RATIO_MIN, Math.min(COL_RATIO_MAX, Math.round(value)))
}

/** Convert a left-column percentage to grid-template-columns value */
export function ratioToGrid(ratio: number): string {
  const clamped = clampRatio(ratio)
  return `${clamped}% ${100 - clamped}%`
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: () => ReturnType
      unsetColumns: () => ReturnType
      /** Set left column width as a percentage (15–85) */
      setColumnRatio: (ratio: number) => ReturnType
    }
  }
}

export const DocColumnsExtension = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column column',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      ratio: {
        default: COL_RATIO_DEFAULT,
        parseHTML: (el: HTMLElement) => {
          const raw = el.getAttribute('data-col-ratio')
          if (!raw) return COL_RATIO_DEFAULT
          const parsed = Number(raw)
          return Number.isFinite(parsed) ? clampRatio(parsed) : COL_RATIO_DEFAULT
        },
        renderHTML: (attrs: Record<string, any>) => {
          const ratio = typeof attrs.ratio === 'number' ? clampRatio(attrs.ratio) : COL_RATIO_DEFAULT
          return {
            'data-col-ratio': ratio,
            'style': `grid-template-columns: ${ratioToGrid(ratio)}`,
          }
        },
      },
    }
  },

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

      setColumnRatio:
        (ratio: number) =>
        ({ state, tr, dispatch }) => {
          if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return false

          const clamped = clampRatio(ratio)
          const { $from } = state.selection

          // Walk ancestors to find the columns node
          let columnsPos = -1
          let columnsNode = null as any
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'columns') {
              columnsPos = $from.before(d)
              columnsNode = $from.node(d)
              break
            }
          }
          if (columnsPos < 0 || !columnsNode) return false

          if (dispatch) {
            tr.setNodeMarkup(columnsPos, undefined, { ...columnsNode.attrs, ratio: clamped })
            dispatch(tr)
          }

          return true
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
