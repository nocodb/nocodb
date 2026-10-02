import type { Component } from 'vue'
import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'
import type { Instance, Placement } from 'tippy.js'

export default (comp: Component, opts?: { placement?: Placement }) => ({
  render: () => {
    let component: VueRenderer | undefined
    // Only created once the suggestion has a `clientRect` to anchor to — which
    // may not be available on `onStart` (e.g. decoration not yet in the DOM),
    // so every access below must tolerate it being undefined.
    let popup: Instance[] | undefined

    function ensurePopup(props: Record<string, any>) {
      if (popup || !props.clientRect || !component) return

      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: opts?.placement ?? 'bottom-start',
      })
    }

    return {
      onStart: (props: Record<string, any>) => {
        component = new VueRenderer(comp, {
          props,
          editor: props.editor,
        })

        ensurePopup(props)
      },

      onUpdate(props: Record<string, any>) {
        component?.updateProps(props)

        if (!props.clientRect) {
          return
        }

        if (!popup) {
          ensurePopup(props)
          return
        }

        popup[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props: Record<string, any>) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide()

          return true
        }

        return component?.ref?.onKeyDown(props)
      },

      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
        popup = undefined
        component = undefined
      },
    }
  },
})
