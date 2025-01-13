import taskListPlugin from 'markdown-it-task-lists'
import { Node } from '@tiptap/core'
import { BulletList } from './bullet-list'
import type { MarkdownNodeSpec } from '../tiptap'

// TODO: Extend from tiptap extension
export const TaskList = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'taskList',

  addStorage() {
    return {
      markdown: {
        serialize: BulletList.storage.markdown.serialize,
        parse: {
          setup(markdownit) {
            markdownit.use(taskListPlugin)
          },
          updateDOM(element) {
            ;[...element.querySelectorAll('.contains-task-list')].forEach((list) => {
              list.setAttribute('data-type', 'taskList')
            })
          },
        },
      },
    }
  },
})
