/**
 * Inline Highlight mark — lightweight alternative to @tiptap/extension-highlight.
 * Renders <mark data-color="…" style="background-color:…"> around selected text.
 * Supports multiple colours via the `color` attribute (multicolor mode).
 *
 * Commands exposed on the editor chain:
 *   .setHighlight({ color })   — apply highlight to current selection
 *   .unsetHighlight()          — remove highlight from current selection
 */
import { Mark, mergeAttributes } from '@tiptap/core'

export const DocHighlightExtension = Mark.create({
  name: 'highlight',

  addAttributes() {
    return {
      color: {
        default: null,
        // Read colour from data-attr first, fall back to inline style (for pasted HTML)
        parseHTML: (el: HTMLElement) => el.getAttribute('data-color') || el.style.backgroundColor || null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.color) return {}
          // Validate color to prevent CSS injection via crafted ProseMirror JSON
          const safe = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/.test(attrs.color)
          if (!safe) return {}
          return { 'data-color': attrs.color, style: `background-color: ${attrs.color}` }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'mark' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setHighlight:
        (attributes?: { color?: string }) =>
        ({ commands }: any) =>
          commands.setMark('highlight', attributes),
      unsetHighlight:
        () =>
        ({ commands }: any) =>
          commands.unsetMark('highlight'),
    }
  },
})
