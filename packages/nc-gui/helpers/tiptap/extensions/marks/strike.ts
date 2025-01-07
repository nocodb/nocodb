import TiptapStrike from '@tiptap/extension-strike'
import type MarkdownIt from 'markdown-it'
import { mdStrikeExt } from '../functionality/markdown'

export const Strike = TiptapStrike.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: '~', close: '~', mixable: true, expelEnclosingWhitespace: true },
        parse: {
          setup(markdownit: MarkdownIt) {
            markdownit.use(mdStrikeExt)
          },
        },
      },
    }
  },
})
