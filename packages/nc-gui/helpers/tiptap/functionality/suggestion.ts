import type { Component } from 'vue'
import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'
import type { Instance, Placement } from 'tippy.js'

// Keydown events the open list consumed. ProseMirror prevents default on every
// Escape, so outer handlers can't use `defaultPrevented` to tell.
export const suggestionHandledKeyEvents = new WeakSet<Event>()

export default (comp: Component, opts?: { placement?: Placement }) => ({
  render: () => {
    let component: VueRenderer | undefined
    // Created lazily: `clientRect` may be missing on `onStart`.
    let popup: Instance[] | undefined
    // Escape only hides the popup — the plugin stays active until the trigger
    // text is left, so later keys (Enter) must reach the editor, not the list.
    let dismissed = false

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
        dismissed = false
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
          if (!dismissed) ensurePopup(props)
          return
        }

        popup[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props: Record<string, any>) {
        if (dismissed) return false

        if (props.event.key === 'Escape') {
          popup?.[0]?.hide()
          dismissed = true
          suggestionHandledKeyEvents.add(props.event)

          return true
        }

        return component?.ref?.onKeyDown(props)
      },

      onExit() {
        popup?.[0]?.destroy()
        component?.destroy()
        popup = undefined
        component = undefined
        dismissed = false
      },
    }
  },
})
