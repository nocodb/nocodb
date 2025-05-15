import taskListPlugin from 'markdown-it-task-lists'
import { Node } from '@tiptap/core'
import type { MarkdownNodeSpec } from '../../types'
import { BulletList } from './bullet-list'

// TODO: Extend from tiptap extension
export const TaskList = Node.create<any, { markdown: MarkdownNodeSpec }>({
  name: 'taskList',

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any, parent: any, index: number) {
          // Get the previous sibling node
          const previousNode = parent && index > 0 ? parent.child(index - 1) : null

          // Check if the previous node is a different type of list
          const isDifferentListType =
            previousNode && previousNode.type.name !== node.type.name && previousNode.type.name === 'bulletList'
          // Add ` <br>\n\n ` if transitioning from a different list type
          if (isDifferentListType) {
            state.write('<br>\n\n ')
          }

          // Use BulletList's serialize logic
          return BulletList.storage.markdown.serialize.call(this, state, node, parent, index)
        },

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
