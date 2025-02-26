import type { SortableEvent } from 'sortablejs'
import Sortable from 'sortablejs'
import type { MaybeRef } from '@vueuse/core'
import { watchPostEffect } from '@vue/runtime-core'

export function useSortable(
  element: MaybeRef<HTMLElement | undefined>,
  items: MaybeRef<any[]>,
  updateModelValue: (data: string | Record<string, any>[]) => void,
  isReadonly: MaybeRef<boolean> = false,
) {
  const dragging = ref(false)

  function onSortStart(evt: SortableEvent) {
    evt.stopImmediatePropagation()
    evt.preventDefault()
    dragging.value = true
  }

  async function onSortEnd(evt: SortableEvent) {
    evt.stopImmediatePropagation()
    evt.preventDefault()
    dragging.value = false

    const _items = unref(items)

    if (_items.length < 2) return

    const { newIndex = 0, oldIndex = 0 } = evt

    if (newIndex === oldIndex) return

    _items.splice(newIndex, 0, ..._items.splice(oldIndex, 1))

    updateModelValue(_items)
  }

  let sortable: Sortable

  // todo: replace with vuedraggable
  const initSortable = (el: HTMLElement) => {
    sortable = new Sortable(el, {
      handle: '.nc-attachment',
      ghostClass: 'ghost',
      animation: 70,
      onStart: onSortStart,
      onEnd: onSortEnd,
      revertOnSpill: true,
    })
  }

  watchPostEffect((onCleanup) => {
    const _element = unref(element)

    onCleanup(() => {
      if (_element && sortable?.el) {
        sortable.destroy()
      }
    })

    if (_element && !unref(isReadonly)) initSortable(_element)
  })

  return {
    dragging,
    initSortable,
  }
}
