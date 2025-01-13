import { Node } from '@tiptap/core'
import type { MarkdownNodeSpec } from '../../types'

// TODO: Extend from tiptap extension
export const CodeBlock = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'codeBlock',

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          state.write(`\`\`\`${node.attrs.language || ''}\n`)
          state.text(node.textContent, false)
          state.ensureNewLine()
          state.write('```')
          state.closeBlock(node)
        },
        parse: {
          setup(markdownit) {
            markdownit.set({
              langPrefix: this.options.languageClassPrefix ?? 'language-',
            })
          },
          updateDOM(element) {
            element.innerHTML = element.innerHTML.replace(/\n<\/code><\/pre>/g, '</code></pre>')
          },
        },
      },
    }
  },
})
