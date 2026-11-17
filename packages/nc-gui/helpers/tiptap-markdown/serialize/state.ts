import type { Mark, Node } from '@tiptap/pm/model'
import { MarkdownSerializerState as BaseMarkdownSerializerState } from '@tiptap/pm/markdown'
import { trimInline } from '../util/markdown'

interface InlineState {
  delimiter?: string
  start?: number
  end?: number
}

/**
 * Override default MarkdownSerializerState to:
 * - handle commonmark delimiters (https://spec.commonmark.org/0.29/#left-flanking-delimiter-run)
 */
export class MarkdownSerializerState extends BaseMarkdownSerializerState {
  inTable = false
  public inlines: InlineState[] = []
  public out = ''

  constructor(nodes, marks, options) {
    super(nodes, marks, options ?? {})
    this.inlines = []
  }

  // Covers whitespace ProseMirror moves out of a mark ("  **bold**") too, which bypasses the text node serializer
  override text(text: string, escape = true): void {
    const atLineStart = this.atBlockStart || this.out.endsWith('<br>')
    if (escape && atLineStart && this.options.preserveLeadingSpaces) {
      text = text.replace(/^[ \u00A0]+/, (spaces) => '&nbsp;'.repeat(spaces.length))
    }
    super.text(text, escape)
  }

  override render(node: Node, parent: Node, index: number): void {
    super.render(node, parent, index)
    const top = this.inlines[this.inlines.length - 1]
    if (top?.start && top?.end) {
      const { delimiter, start, end } = this.normalizeInline(top)
      this.out = trimInline(this.out, delimiter, start, end)
      this.inlines.pop()
    }
  }

  override markString(mark: Mark, open: boolean, parent: Node, index: number): string {
    const info = this.marks[mark.type.name]
    if (info.expelEnclosingWhitespace) {
      if (open) {
        this.inlines.push({
          start: this.out.length,
          delimiter: info.open,
        })
      } else {
        const top = this.inlines.pop() || {}
        this.inlines.push({
          ...top,
          end: this.out.length,
        })
      }
    }
    return super.markString(mark, open, parent, index)
  }

  normalizeInline(inline) {
    let { start } = inline
    while (this.out.charAt(start).match(/\s/)) {
      start++
    }
    return {
      ...inline,
      start,
    }
  }
}
