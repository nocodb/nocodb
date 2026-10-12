import data from 'emoji-mart-vue-fast/data/apple.json'
import { EmojiIndex } from 'emoji-mart-vue-fast/src'

const buildEmojiIndex = () =>
  new EmojiIndex(data, {
    emojisToShowFilter: (emoji: any) => {
      if (Number(emoji.added_in) >= 14) {
        return false
      }

      return true
    },
  })

let emojiIndex: ReturnType<typeof buildEmojiIndex> | undefined

// Shared and built on first open: an index costs ~40ms and every sidebar node renders a picker.
export const getEmojiIndex = () => (emojiIndex ??= buildEmojiIndex())
