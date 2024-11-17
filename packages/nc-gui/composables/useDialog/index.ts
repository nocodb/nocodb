import type { AppContext, VNode } from '@vue/runtime-dom'
import { Suspense, isVNode, render } from '@vue/runtime-dom'
import type { ComponentPublicInstance } from '@vue/runtime-core'
import type { MaybeRef } from '@vueuse/core'
import { isClient } from '@vueuse/core'

interface UseDialogOptions {
  target: MaybeRef<HTMLElement | ComponentPublicInstance>
  context: Partial<AppContext>
}

/**
 * Programmatically create a component and attach it to the body (or a specific mount target), like a dialog or modal.
 * This composable is not SSR friendly - it should be used only on the client.
 *
 * @param componentOrVNode The component to create and attach. Can be a VNode or a component definition.
 * @param props The props to pass to the component.
 * @param options Additional options to use {@see UseDialogOptions}
 *
 * @example
 *
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
  { target, context }: Partial<UseDialogOptions> = {},
) {
  if (typeof document === 'undefined' || !isClient) {
    console.warn('[useDialog]: Cannot use outside of browser!')
  }

  const closeHook = createEventHook<void>()
  const mountedHook = createEventHook<void>()

  const isMounted = ref(false)

  const domNode = document.createElement('div')

  const vNodeRef = ref<VNode>()

  const mountTarget = ref<HTMLElement>()

  /** When props change, we want to re-render the element with the new prop values */
  const stop = watch(
    toReactive(props),
    (reactiveProps) => {
      const _mountTarget = unref(target)

      /**
       * If it's a component instance, use the instance's root element (`$el`), otherwise use the element itself
       * If no target is specified, use the document body
       */
      mountTarget.value = _mountTarget
        ? '$el' in _mountTarget
          ? (_mountTarget.$el as HTMLElement)
          : _mountTarget
        : document.body

      /** if specified, append vnode to mount target instead of document.body */
      mountTarget.value.appendChild(domNode)

      // if it's a vnode, just render it, otherwise wrap in `h` to create a vnode
      const vNode = isVNode(componentOrVNode) ? componentOrVNode : h(componentOrVNode, reactiveProps)

      vNode.appContext = { ...useNuxtApp().vueApp._context, ...context }

      vNodeRef.value = vNode

      // wrap in suspense to resolve potential promises
      render(h(Suspense, vNode), domNode)

      if (!isMounted.value) mountedHook.trigger()
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
          ;(mountTarget.value as HTMLElement)?.removeChild(domNode)
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
