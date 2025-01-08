import { MarkdownSerializerState as BaseMarkdownSerializerState } from 'prosemirror-markdown'
import { trimInline } from '../util/markdown'

/**
 * Override default MarkdownSerializerState to:
 * - handle commonmark delimiters (https://spec.commonmark.org/0.29/#left-flanking-delimiter-run)
 */
export class MarkdownSerializerState extends BaseMarkdownSerializerState {
  inTable = false

  constructor(nodes, marks, options) {
    super(nodes, marks, options ?? {})
    this.inlines = []
  }

  render(node, parent, index) {
    super.render(node, parent, index)
    const top = this.inlines[this.inlines.length - 1]
    if (top?.start && top?.end) {
      const { delimiter, start, end } = this.normalizeInline(top)
      this.out = trimInline(this.out, delimiter, start, end)
      this.inlines.pop()
    }
  }

  markString(mark, open, parent, index) {
    const info = this.marks[mark.type.name]
    if (info.expelEnclosingWhitespace) {
      if (open) {
        this.inlines.push({
          start: this.out.length,
          delimiter: info.open,
        })
      } else {
        const top = this.inlines.pop()
        this.inlines.push({
          ...top,
          end: this.out.length,
        })
      }
    }
    return super.markString(mark, open, parent, index)
  }

  normalizeInline(inline) {
    let { start, end } = inline
    while (this.out.charAt(start).match(/\s/)) {
      start++
    }
    return {
      ...inline,
      start,
    }
  }
}
