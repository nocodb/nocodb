import { Node } from '@tiptap/core'
import { childNodes } from '../../util/prosemirror'
import type { MarkdownNodeSpec } from '../../types'
import { HTMLNode } from './html'

export const Table = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'table',

  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent) {
          if (!isMarkdownSerializable(node)) {
            HTMLNode.storage.markdown.serialize.call(this, state, node, parent)
            return
          }
          state.inTable = true
          node.forEach((row, p, i) => {
            state.write('| ')
            row.forEach((col, p, j) => {
              if (j) {
                state.write(' | ')
              }
              // A cell holds one line: its paragraphs are joined with <br>, which loads back as line breaks
              col.forEach((paragraph, _, k) => {
                if (k) {
                  state.write('<br>')
                }
                if (paragraph.textContent.trim()) {
                  state.renderInline(paragraph)
                }
              })
            })
            state.write(' |')
            state.ensureNewLine()
            if (!i) {
              const delimiterRow = Array.from({ length: row.childCount })
                .map(() => '---')
                .join(' | ')
              state.write(`| ${delimiterRow} |`)
              state.ensureNewLine()
            }
          })
          state.closeBlock(node)
          state.inTable = false
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})

function hasSpan(node) {
  return node.attrs.colspan > 1 || node.attrs.rowspan > 1
}

function hasOnlyParagraphs(cell) {
  return childNodes(cell).every((child) => child.type.name === 'paragraph')
}

function isMarkdownSerializable(node) {
  const rows = childNodes(node)
  const firstRow = rows[0]
  const bodyRows = rows.slice(1)

  if (childNodes(firstRow).some((cell) => cell.type.name !== 'tableHeader' || hasSpan(cell) || !hasOnlyParagraphs(cell))) {
    return false
  }

  if (
    bodyRows.some((row) =>
      childNodes(row).some((cell) => cell.type.name === 'tableHeader' || hasSpan(cell) || !hasOnlyParagraphs(cell)),
    )
  ) {
    return false
  }

  return true
}
