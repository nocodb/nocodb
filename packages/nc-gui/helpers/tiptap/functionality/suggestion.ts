import type { Component } from 'vue'
import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'
import type { Placement } from 'tippy.js'

export default (comp: Component, opts?: { placement?: Placement }) => ({
  render: () => {
    let component: VueRenderer
    let popup: any

    return {
      onStart: (props: Record<string, any>) => {
        component = new VueRenderer(comp, {
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
          placement: opts?.placement ?? 'bottom-start',
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

          return true
        }

        return component.ref?.onKeyDown(props)
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
})
