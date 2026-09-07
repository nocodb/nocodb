import { Mark, mergeAttributes } from '@tiptap/core'

// Email-safe highlight. Renders a <span> rather than <mark>: Outlook's Word engine does not
// paint <mark>, but honours an inline background-color on any span.

export const HIGHLIGHT_COLORS = [
  { name: 'None', color: '' },
  { name: 'Gray', color: '#e5e7eb' },
  { name: 'Orange', color: '#fed7aa' },
  { name: 'Pink', color: '#fbcfe8' },
  { name: 'Yellow', color: '#fef08a' },
  { name: 'Green', color: '#bbf7d0' },
  { name: 'Blue', color: '#bfdbfe' },
  { name: 'Purple', color: '#e9d5ff' },
  { name: 'Rose', color: '#fecdd3' },
  { name: 'Red', color: '#fecaca' },
] as const

const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      setHighlight: (attributes: { color: string }) => ReturnType
      unsetHighlight: () => ReturnType
    }
  }
}

export const Highlight = Mark.create({
  name: 'highlight',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-highlight') || el.style.backgroundColor || null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.color || !SAFE_COLOR.test(attrs.color)) return {}
          return { 'data-highlight': attrs.color, 'style': `background-color: ${attrs.color}` }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-highlight]' },
      { tag: 'mark' },
      { style: 'background-color', getAttrs: (value) => ({ color: value }) },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setHighlight:
        (attributes) =>
        ({ commands }) =>
          commands.setMark(this.name, attributes),
      unsetHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
