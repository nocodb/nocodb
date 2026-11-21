import { mergeAttributes } from '@tiptap/core'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { Fragment, DOMParser as PMDOMParser, type Schema } from '@tiptap/pm/model'
import { CellSelection } from '@tiptap/pm/tables'

// Rich Text cells store GFM pipe tables: a header row, text-only cells, no merged cells.
// A table outside that shape is saved as HTML, so the editor keeps every table inside it.

const RichTextTable = Table.extend({
  // No <colgroup>: ProseMirror never patches it, so it goes stale after a column is added or removed.
  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ['tbody', 0]]
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      // A pipe-table cell holds one line, so Enter adds a line break instead of a paragraph.
      Enter: () => {
        const { editor } = this
        if (!editor.isActive('tableCell') && !editor.isActive('tableHeader')) return false
        if (editor.state.selection instanceof CellSelection) return true
        return editor.commands.setHardBreak()
      },
    }
  },
}).configure({ resizable: false })

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
])

/** Each run of inline content in `el`, at any depth, as its own <p>. */
function lines(el: Element): HTMLElement[] {
  const out: HTMLElement[] = []
  let current: HTMLElement | null = null

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName)) {
      current = null
      out.push(...lines(child as Element))
      continue
    }

    if (!current) {
      current = el.ownerDocument.createElement('p')
      out.push(current)
    }
    current.appendChild(child.cloneNode(true))
  }

  return out.filter((p) => p.textContent?.trim() || p.querySelector('img, br'))
}

// A list or code block in a pasted cell would otherwise be lifted out of the table, splitting it.
function cellContent(dom: HTMLElement, schema: Schema) {
  const parser = PMDOMParser.fromSchema(schema)
  const paragraphs = lines(dom).map((p) => parser.parse(p, { topNode: schema.nodes.paragraph!.create() }))

  return Fragment.from(paragraphs.length ? paragraphs : schema.nodes.paragraph!.create())
}

// Column alignment from a pipe table's delimiter row (markdown-it writes it as `text-align`).
const alignAttribute = {
  align: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.textAlign || el.getAttribute('align') || null,
    renderHTML: (attrs: { align?: string | null }) => (attrs.align ? { style: `text-align: ${attrs.align}` } : {}),
  },
}

const RichTextTableCell = TableCell.extend({
  content: 'paragraph+',

  addAttributes() {
    return { ...this.parent?.(), ...alignAttribute }
  },

  parseHTML() {
    return [{ tag: 'td', getContent: (dom, schema) => cellContent(dom as HTMLElement, schema) }]
  },
})

const RichTextTableHeader = TableHeader.extend({
  content: 'paragraph+',

  addAttributes() {
    return { ...this.parent?.(), ...alignAttribute }
  },

  parseHTML() {
    return [{ tag: 'th', getContent: (dom, schema) => cellContent(dom as HTMLElement, schema) }]
  },
})

export const richTextTableExtensions = [RichTextTable, TableRow, RichTextTableHeader, RichTextTableCell]
