/**
 * Inline TextColor mark — renders <span data-text-color="…" style="color:…"> around selected text.
 * Supports multiple colours via the `color` attribute.
 *
 * Commands exposed on the editor chain:
 *   .setTextColor({ color })   — apply text colour to current selection
 *   .unsetTextColor()          — remove text colour from current selection
 */
import { Mark, mergeAttributes } from '@tiptap/core'

export const DocTextColorExtension = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-text-color') || el.style.color || null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.color) return {}
          const safe = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/.test(attrs.color)
          if (!safe) return {}
          return { 'data-text-color': attrs.color, 'style': `color: ${attrs.color}` }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-text-color]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setTextColor:
        (attributes?: { color?: string }) =>
        ({ commands }: any) =>
          commands.setMark('textColor', attributes),
      unsetTextColor:
        () =>
        ({ commands }: any) =>
          commands.unsetMark('textColor'),
    }
  },
})
