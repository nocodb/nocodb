import * as TipTapMention from '@tiptap/extension-mention'

export const Mention = TipTapMention.Mention.extend({
  renderHTML({ HTMLAttributes: _ }) {
    return ['span']
  },
  renderText({ node: _ }) {
    return ''
  },
})
