import type { VNode } from '@vue/runtime-dom'
import { isVNode, render } from '@vue/runtime-dom'
import type { ComponentPublicInstance } from '@vue/runtime-core'
import type { MaybeRef } from '@vueuse/core'
import { isClient } from '@vueuse/core'
import { createEventHook, h, ref, toReactive, tryOnScopeDispose, unref, useNuxtApp, watch } from '#imports'

/**
 * Programmatically create a component and attach it to the body (or a specific mount target), like a dialog or modal.
 * This composable is not SSR friendly - it should be used only on the client.
 *
 * @param componentOrVNode The component to create and attach. Can be a VNode or a component definition.
 * @param props The props to pass to the component.
 * @param mountTarget The target to attach the component to. Defaults to the document body
 *
 * @example
 * import { useDialog } from '#imports'
 * import DlgQuickImport from '~/components/dlg/QuickImport.vue'
 *
 * function openQuickImportDialog(type: string) {
 *   // create a ref for showing/hiding the modal
 *   const isOpen = ref(true)
 *
 *   const { close, vNode } = useDialog(DlgQuickImport, {
 *     'modelValue': isOpen,
 *     'importType': type,
 *     'onUpdate:modelValue': closeDialog,
 *   })
 *
 *   function closeDialog() {
 *     // hide the modal
 *     isOpen.value = false
 *
 *     // debounce destroying the component, so the modal transition can finish
 *     close(1000)
 *   }
 * }
 */
export function useDialog(
  componentOrVNode: any,
  props: NonNullable<Parameters<typeof h>[1]> = {},
  mountTarget?: MaybeRef<Element | ComponentPublicInstance>,
) {
  if (typeof document === 'undefined' || !isClient) {
    console.warn('[useDialog]: Cannot use outside of browser!')
  }

  const closeHook = createEventHook<void>()
  const mountedHook = createEventHook<void>()

  const isMounted = $ref(false)

  const domNode = document.createElement('div')

  const vNodeRef = ref<VNode>()

  let _mountTarget = unref(mountTarget)

  _mountTarget = _mountTarget ? ('$el' in _mountTarget ? (_mountTarget.$el as HTMLElement) : _mountTarget) : document.body

  /** if specified, append vnode to mount target instead of document.body */
  _mountTarget.appendChild(domNode)

  /** When props change, we want to re-render the element with the new prop values */
  const stop = watch(
    toReactive(props),
    (reactiveProps) => {
      const vNode = isVNode(componentOrVNode) ? componentOrVNode : h(componentOrVNode, reactiveProps)

      vNode.appContext = useNuxtApp().vueApp._context

      vNodeRef.value = vNode

      render(vNode, domNode)

      if (!isMounted) mountedHook.trigger()
    },
    { deep: true, immediate: true, flush: 'post' },
  )

  /** When calling scope is disposed, destroy component */
  tryOnScopeDispose(close)

  /** destroy component, can be debounced */
  function close(debounce = 0) {
    setTimeout(() => {
      stop()

      render(null, domNode)

      setTimeout(() => {
        try {
          ;(_mountTarget as HTMLElement)?.removeChild(domNode)
        } catch (e) {}
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
