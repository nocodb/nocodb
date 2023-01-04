import type { Editor, Range } from '@tiptap/vue-3'
import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'

import CommandsList from './CommandsList.vue'

export default {
  items: ({ query }: { query: any }) => {
    return [
      {
        title: 'Heading 1',
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
        },
      },
      {
        title: 'Heading 2',
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
        },
      },
      {
        title: 'Heading 3',
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
        },
      },
      {
        title: 'Horizontal Rule',
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          ;(editor.chain().focus().deleteRange(range).setNode('horizontalRule').focus() as any).setHorizontalRule().run()
        },
      },
      {
        title: 'Bullet List',
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode('bulletList').run()
          ;(editor.chain().focus() as any).toggleBulletList().run()
        },
      },
      {
        title: 'Numbered List',
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode('orderedList').run()
          ;(editor.chain().focus() as any).toggleOrderedList().run()
        },
      },
      {
        title: 'Task list',
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode('taskList').run()
          ;(editor.chain().focus() as any).toggleTaskList().run()
        },
      },
      // {
      //   title: 'Add Image',
      //   command: ({ editor, range }: { editor: Editor; range: Range }) => {
      //     // todo: open file picker in vue3
      //     const url = 'https://picsum.photos/200/300'
      //     // add image block node
      //     ;(editor.chain().focus().deleteRange(range) as any).setImage({ src: url }).run()
      //   },
      // },
    ]
      .filter((item) => item.title.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 10)
  },
  startOfLine: true,
  render: () => {
    let component: any
    let popup: any
    let editor: Editor

    return {
      onStart: (props: Record<string, any>) => {
        editor = props.editor
        component = new VueRenderer(CommandsList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          onHidden: () => {
            // todo: Not using the timeout removes the formating option of the node selected
            setTimeout(() => {
              editor.chain().focus().deleteRange(props.range).run()
            }, 50)
          },
        })
      },

      onUpdate(props: Record<string, any>) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props: Record<string, any>) {
        if (props.event.key === 'Escape') {
          popup[0].hide()

          // clear content of the current node
          editor.chain().focus().deleteRange(props.range).run()

          return true
        }

        return component.ref?.onKeyDown(props)
      },

      onExit() {
        if (popup) popup[0].destroy()
        component?.destroy()
      },
    }
  },
}
