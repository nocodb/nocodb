import type { VNode } from '@vue/runtime-dom'
import { render } from '@vue/runtime-dom'
import type { ComponentPublicInstance } from '@vue/runtime-core'
import { createEventHook, h, ref, toReactive, tryOnScopeDispose, useNuxtApp, watch } from '#imports'

/**
 * Programmatically create a component and attach it to the body (or a specific mount target), like a dialog or modal.
 */
export function useDialog(
  component: any,
  props: NonNullable<Parameters<typeof h>[1]> = {},
  mountTarget?: Element | ComponentPublicInstance,
) {
  const closeHook = createEventHook<void>()
  const mountedHook = createEventHook<void>()

  const isMounted = $ref(false)

  const domNode = document.createElement('div')

  const vNodeRef = ref<VNode>()

  mountTarget = mountTarget ? ('$el' in mountTarget ? (mountTarget.$el as HTMLElement) : mountTarget) : document.body

  /** if specified, append vnode to mount target instead of document.body */
  mountTarget.appendChild(domNode)

  /** When props change, we want to re-render the element with the new prop values */
  const stop = watch(
    toReactive(props),
    (reactiveProps) => {
      const vNode = h(component, reactiveProps)

      vNode.appContext = useNuxtApp().vueApp._context

      vNodeRef.value = vNode

      render(vNode, domNode)

      if (!isMounted) mountedHook.trigger()
    },
    { deep: true, immediate: true, flush: 'post' },
  )

  /** When calling scope is disposed, destroy component */
  tryOnScopeDispose(() => {
    close()
    stop()
  })

  /** destroy component, can be debounced */
  function close(debounce = 0) {
    setTimeout(() => {
      stop()

      render(null, domNode)

      setTimeout(() => {
        ;(mountTarget as HTMLElement)!.removeChild(domNode)
      }, 100)

      closeHook.trigger()
    }, debounce)
  }

  return {
    close,
    onClose: closeHook.on,
    onMounted: mountedHook.on,
    domNode,
    vNode: vNodeRef,
  }
}
