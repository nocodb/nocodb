import type { Editor, Range } from '@tiptap/vue-3'
import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'

import CommandsList from './CommandsList.vue'

export default {
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
