import { Extension, InputRule } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import EmojiSuggestionList from './EmojiSuggestionList.vue'
import { suggestion } from '~/helpers/tiptap'
import type { getEmojiIndex } from '~/utils/emojiIndex'

export interface EmojiSuggestionOptions {
  /** For telemetry: the host wires its `$e` here, since this module has no Nuxt context. */
  onInsert?: (source: 'list' | 'shortcode') => void
}

export interface EmojiSuggestionItem {
  id: string
  native: string
  shortName: string
}

// Loaded on first editor create so the emoji data stays out of the comment chunk.
let emojiIndex: ReturnType<typeof getEmojiIndex> | undefined

async function loadEmojiIndex() {
  if (!emojiIndex) emojiIndex = (await import('~/utils/emojiIndex')).getEmojiIndex()

  return emojiIndex
}

const MAX_SUGGESTIONS = 8

const DEFAULT_SUGGESTIONS = ['+1', 'heart', 'joy', 'smile', 'tada', 'eyes', 'pray', 'fire']

/** `:` opens an emoji list; a completed `:smile:` is replaced with the emoji. Stored as plain unicode text. */
export const EmojiSuggestion = Extension.create<EmojiSuggestionOptions>({
  name: 'emojiSuggestion',

  addOptions() {
    return { onInsert: undefined }
  },

  onCreate() {
    loadEmojiIndex()
  },

  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|\s)(:[\w+-]+:)$/,
        handler: ({ state, range, match }) => {
          const shortcode = match[1]!
          const native = emojiIndex?.findEmoji(shortcode)?.native
          if (!native) return null

          // The closing ":" is the key being typed, so only the rest is in the doc.
          state.tr.insertText(native, range.to - (shortcode.length - 1), range.to)

          this.options.onInsert?.('shortcode')
        },
      }),
    ]
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<EmojiSuggestionItem>({
        editor: this.editor,
        pluginKey: new PluginKey('emojiSuggestion'),
        // Opens on a ":" that starts a word ("a:b" never triggers); a bare ":" lists common picks.
        char: ':',
        items: async ({ query }) => {
          const index = await loadEmojiIndex()

          const term = query.replace(/:$/, '')

          // Emoji search also matches emoticon text (")" → 🇨🇨), so ":)" or ":-)" must list nothing; ":+1" / ":-1" still do.
          if (term && !/^(?:[\p{L}\p{N}]|[+-]\d)/u.test(term)) return []

          const emojis = term
            ? index.search(term, MAX_SUGGESTIONS) ?? []
            : DEFAULT_SUGGESTIONS.map((id) => index.findEmoji(id)).filter(Boolean)

          return emojis.map((emoji) => ({
            id: emoji.id,
            native: emoji.native,
            shortName: emoji.short_name,
          }))
        },
        command: ({ editor, range, props }) => {
          editor.chain().focus().insertContentAt(range, props.native).run()

          this.options.onInsert?.('list')
        },
        ...suggestion(EmojiSuggestionList),
      }),
    ]
  },
})
