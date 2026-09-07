import { Extension } from '@tiptap/core'

// Web-safe stacks only: an email can't ship fonts, so anything else falls back unpredictably.
export const EMAIL_FONTS = [
  { name: 'Sans Serif', value: '' },
  { name: 'Serif', value: "Georgia, 'Times New Roman', serif" },
  { name: 'Monospace', value: "'Courier New', Courier, monospace" },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { name: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { name: 'Trebuchet MS', value: "'Trebuchet MS', Helvetica, sans-serif" },
  { name: 'Garamond', value: 'Garamond, Georgia, serif' },
  { name: 'Comic Sans MS', value: "'Comic Sans MS', cursive" },
] as const

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType
      unsetFontFamily: () => ReturnType
    }
  }
}

export const FontFamily = Extension.create({
  name: 'fontFamily',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontFamily || null,
            renderHTML: (attrs: Record<string, any>) => (attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {}),
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontFamily }).run(),
      unsetFontFamily:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run(),
    }
  },
})
