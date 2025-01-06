import TiptapHardBreak from '@tiptap/extension-hard-break'

export const HardBreak = TiptapHardBreak.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          for (let i = index + 1; i < parent.childCount; i++)
            if (parent.child(i).type !== node.type) {
              state.write(state.inTable ? HTMLNode.storage.markdown.serialize.call(this, state, node, parent) : '</br>')
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
