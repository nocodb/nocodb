import TiptapStrike from '@tiptap/extension-strike'
import type MarkdownIt from 'markdown-it'
import { mcStrikeExt } from '../functionality/markdown/index'

export const Strike = TiptapStrike.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: '~', close: '~', expelEnclosingWhitespace: true },
        parse: {
          setup(markdownit: MarkdownIt) {
            markdownit.use(mcStrikeExt)
          },
        },
      },
    }
  },
})
