import type { StrikeOptions } from '@tiptap/extension-strike'
import type { MarkdownMarkSpec } from '../../types'
import { markInputRule, markPasteRule } from '@tiptap/core'
import TiptapStrike from '@tiptap/extension-strike'

/**
 * Matches a strike to a ~strike~ on input.
 */
export const inputSingleTildeRegex = /(?:^|\s)(~(?!\s+~)([^~]+)~(?!\s+~))$/

/**
 * Matches a strike to a ~strike~ on paste.
 */
export const pasteSingleTildeRegex = /(?:^|\s)(~(?!\s+~)([^~]+)~(?!\s+~))/g

export const Strike = TiptapStrike.extend<StrikeOptions, { markdown: MarkdownMarkSpec }>({
  addInputRules() {
    return [
      ...(this.parent?.() ?? []),
      markInputRule({
        find: inputSingleTildeRegex,
        type: this.type,
      }),
    ]
  },

  addPasteRules() {
    return [
      ...(this.parent?.() ?? []),
      markPasteRule({
        find: pasteSingleTildeRegex,
        type: this.type,
      }),
    ]
  },
  addStorage() {
    return {
      markdown: {
        serialize: { open: '~', close: '~', mixable: true, expelEnclosingWhitespace: true },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
