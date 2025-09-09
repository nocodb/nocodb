import TiptapHardBreak, { type HardBreakOptions } from '@tiptap/extension-hard-break'
import type { MarkdownNodeSpec } from '../../types'
import { HTMLNode } from './html'

export const HardBreak = TiptapHardBreak.extend<HardBreakOptions, { markdown: MarkdownNodeSpec }>({
  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          for (let i = index + 1; i < parent.childCount; i++) {
            if (parent.child(i).type !== node.type) {
              state.write(state?.inTable ? HTMLNode.storage.markdown.serialize.call(this, state, node, parent) : '<br>')
              return
            }
          }
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
  addKeyboardShortcuts() {
    return {
      'Shift-Enter': () => {
        const did = this.editor.commands.setHardBreak()

        console.log('did', did)
        // Only scroll if hard break was inserted
        if (did) {
          requestAnimationFrame(() => {
            this.editor.view.dispatch(this.editor.state.tr.scrollIntoView())
          })
        }

        return true
      },
      // 'Mod-Enter' is intentionally omitted
    }
  },
})
