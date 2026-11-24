import { Node } from '@tiptap/core'
import type { MarkdownNodeSpec } from '../../types'

// TODO: Extend from tiptap extension
export const CodeBlock = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'codeBlock',

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          // Longer than any backtick run in the code, so an inner ``` doesn't close the block
          const longestRun = Math.max(0, ...(node.textContent.match(/`+/g) ?? []).map((run) => run.length))
          const fence = '`'.repeat(Math.max(3, longestRun + 1))

          state.write(`${fence}${node.attrs.language || ''}\n`)
          // Always end with a newline: updateDOM strips one, so trailing blank lines survive
          state.text(`${node.textContent}\n`, false)
          state.write(fence)
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
