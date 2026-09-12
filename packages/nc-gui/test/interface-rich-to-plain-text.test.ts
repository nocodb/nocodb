import { interfaceRichToPlainText } from '~/ee/utils/interfaceUtils'

const doc = (...paragraphs: string[]) =>
  JSON.stringify({
    type: 'doc',
    content: paragraphs.map((text) => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) })),
  })

// The overview panes store the raw ProseMirror doc and read it back through this
// helper for previews (breadcrumbs, bookmark rows, viewer visibility).
describe('interfaceRichToPlainText', () => {
  it('collapses whitespace to a single-line preview', () => {
    expect(interfaceRichToPlainText(doc('Sales   Team  Links   '))).toBe('Sales Team Links')
    expect(interfaceRichToPlainText(doc('  Padded  '))).toBe('Padded')
  })

  it('separates blocks with a single space', () => {
    expect(interfaceRichToPlainText(doc('first', 'second'))).toBe('first second')
    expect(interfaceRichToPlainText(doc('only'))).toBe('only')
    expect(interfaceRichToPlainText(doc(''))).toBe('')
  })

  it('keeps marked-up text in one word (marks split leaves, blocks do not)', () => {
    const marked = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Book' },
            { type: 'text', text: 'marks', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    })

    expect(interfaceRichToPlainText(marked)).toBe('Bookmarks')
  })

  it('handles empty and legacy HTML values', () => {
    expect(interfaceRichToPlainText('')).toBe('')
    expect(interfaceRichToPlainText(null)).toBe('')
    expect(interfaceRichToPlainText('<p>Legacy </p>')).toBe('Legacy')
  })
})
