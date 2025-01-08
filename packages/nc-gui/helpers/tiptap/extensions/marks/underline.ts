import TiptapUnderline from '@tiptap/extension-underline'

export const Underline = TiptapUnderline.extend({
  //   addStorage() {
  //     return {
  //       ...this.parent?.(), // Retain parent storage if any
  //       markdown: {
  //         serialize(state, node, parent) {
  //           console.log('Serializing underline mark:', node)
  //           // Implement your custom logic
  //           const text = state.textBetween(node.from, node.to) // Get the text content
  //           state.write(`<u>${text}</u>`) // Serialize as <u>...</u> tags
  //           return () => undefined
  //         },
  //         parse: {
  //           // handled by markdown-it
  //         },
  //       },
  //     }
  //   },
})
