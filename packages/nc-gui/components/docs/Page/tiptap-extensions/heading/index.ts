import TiptapHeading from '@tiptap/extension-heading'

export const Heading = TiptapHeading.configure({
  HTMLAttributes: {
    'data-tiptap-heading': true,
  },
})
