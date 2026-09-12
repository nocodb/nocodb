import { Extension } from '@tiptap/core'

export type EmailTextAlign = 'left' | 'center' | 'right' | 'justify'

const ALIGNABLE = ['heading', 'paragraph']

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: EmailTextAlign) => ReturnType
      unsetTextAlign: () => ReturnType
    }
  }
}

export const TextAlign = Extension.create({
  name: 'textAlign',

  addGlobalAttributes() {
    return [
      {
        types: ALIGNABLE,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.textAlign || el.getAttribute('align') || null,
            // Left is the default everywhere; emitting it would only add noise to the email.
            renderHTML: (attrs: Record<string, any>) =>
              attrs.textAlign && attrs.textAlign !== 'left' ? { style: `text-align: ${attrs.textAlign}` } : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) =>
          ALIGNABLE.every((type) => commands.updateAttributes(type, { textAlign: alignment })),
      unsetTextAlign:
        () =>
        ({ commands }) =>
          ALIGNABLE.every((type) => commands.resetAttributes(type, 'textAlign')),
    }
  },
})
