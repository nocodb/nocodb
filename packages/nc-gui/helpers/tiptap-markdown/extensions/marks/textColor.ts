import { Mark, mergeAttributes } from '@tiptap/core'

// Email-safe text colour: serialises to an inline style, which is what mail clients honour.
// (The docs editor has its own copy under ee/; CE code cannot import it.)

export const TEXT_COLORS = [
  { name: 'Default', color: '#1f2937' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Brown', color: '#92400e' },
  { name: 'Yellow', color: '#a16207' },
  { name: 'Green', color: '#15803d' },
  { name: 'Blue', color: '#1d4ed8' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Pink', color: '#db2777' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Red', color: '#dc2626' },
] as const

const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (attributes: { color: string }) => ReturnType
      unsetTextColor: () => ReturnType
    }
  }
}

export const TextColor = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-text-color') || el.style.color || null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.color || !SAFE_COLOR.test(attrs.color)) return {}
          return { 'data-text-color': attrs.color, 'style': `color: ${attrs.color}` }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-text-color]' }, { style: 'color', getAttrs: (value) => ({ color: value }) }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setTextColor:
        (attributes) =>
        ({ commands }) =>
          commands.setMark(this.name, attributes),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
