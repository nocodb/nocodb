import TiptapHardBreak, { type HardBreakOptions } from '@tiptap/extension-hard-break'
import { HTMLNode } from './html'
import type { MarkdownNodeSpec } from '../tiptap'

export const HardBreak = TiptapHardBreak.extend<HardBreakOptions, { markdown: MarkdownNodeSpec }>({
  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          for (let i = index + 1; i < parent.childCount; i++)
            if (parent.child(i).type !== node.type) {
              state.write(state?.inTable ? HTMLNode.storage.markdown.serialize.call(this, state, node, parent) : '<br />')
              return
            }
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})
