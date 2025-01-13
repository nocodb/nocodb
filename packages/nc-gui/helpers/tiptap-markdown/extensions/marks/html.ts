import { Fragment } from '@tiptap/pm/model'
import { Mark, getHTMLFromFragment } from '@tiptap/core'
import type { MarkdownMarkSpec } from '../../types'

// TODO: Extend from tiptap extension
export const HTMLMark = Mark.create<any, { markdown: MarkdownMarkSpec }>({
  name: 'markdownHTMLMark',
  addStorage() {
    return {
      markdown: {
        serialize: {
          open(state, mark) {
            if (!this.editor.storage.markdown.options.html) {
              console.warn(`Tiptap Markdown: "${mark.type.name}" mark is only available in html mode`)
              return ''
            }
            return getMarkTags(mark)?.[0] ?? ''
          },
          close(state, mark) {
            if (!this.editor.storage.markdown.options.html) {
              return ''
            }
            return getMarkTags(mark)?.[1] ?? ''
          },
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})

function getMarkTags(mark) {
  const schema = mark.type.schema
  const node = schema.text(' ', [mark])
  const html = getHTMLFromFragment(Fragment.from(node), schema)
  const match = html.match(/^(<.*?>) (<\/.*?>)$/)
  return match ? [match[1], match[2]] : null
}
