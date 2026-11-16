<script lang="ts">
// Mount within MOUNT_PX of the viewport, unmount past UNMOUNT_PX: the gap stops
// cards remounting when the user scrolls back and forth.
const MOUNT_PX = 1200

const UNMOUNT_PX = 2400

interface CardHandlers {
  mount: () => void
  unmount: () => void
}

interface SharedObservers {
  mount: IntersectionObserver
  unmount: IntersectionObserver
  handlers: Map<Element, CardHandlers>
}

// One observer pair per scroll root, shared by every card in it.
const observersByRoot = new Map<HTMLElement | null, SharedObservers>()

function sharedObservers(root: HTMLElement | null): SharedObservers {
  const existing = observersByRoot.get(root)
  if (existing) return existing

  const handlers = new Map<Element, CardHandlers>()
  const observers: SharedObservers = {
    handlers,
    mount: new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) handlers.get(entry.target)?.mount()
      },
      { root, rootMargin: `${MOUNT_PX}px 0px` },
    ),
    unmount: new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // A keyed move detaches the node for a moment and reports it as out of view.
          if (entry.isIntersecting || !entry.target.isConnected || !entry.boundingClientRect.height) continue
          handlers.get(entry.target)?.unmount()
        }
      },
      { root, rootMargin: `${UNMOUNT_PX}px 0px` },
    ),
  }
  observersByRoot.set(root, observers)
  return observers
}

function observeCard(root: HTMLElement | null, el: Element, cardHandlers: CardHandlers) {
  const observers = sharedObservers(root)
  observers.handlers.set(el, cardHandlers)
  observers.mount.observe(el)
  observers.unmount.observe(el)

  return () => {
    observers.mount.unobserve(el)
    observers.unmount.unobserve(el)
    observers.handlers.delete(el)
    if (observers.handlers.size) return
    observers.mount.disconnect()
    observers.unmount.disconnect()
    observersByRoot.delete(root)
  }
}
</script>

<script setup lang="ts">
interface Props {
  root?: HTMLElement | null
  /** Placeholder height until the card has been measured once. */
  estimatedHeight: number
}

const props = defineProps<Props>()

const el = ref<HTMLElement>()

const isMounted = ref(false)

const measuredHeight = ref<number>()

watch(
  [el, () => props.root ?? null],
  ([target, root], _prev, onCleanup) => {
    if (!target) return
    onCleanup(
      observeCard(root, target, {
        mount: () => {
          isMounted.value = true
        },
        unmount: () => {
          if (isMounted.value) measuredHeight.value = target.offsetHeight
          isMounted.value = false
        },
      }),
    )
  },
  { immediate: true },
)
</script>

<template>
  <div ref="el" class="h-full">
    <slot v-if="isMounted" />
    <div
      v-else
      class="nc-gallery-card-placeholder rounded-xl border-1 border-nc-border-gray-medium bg-nc-bg-default"
      :style="{ height: `${measuredHeight ?? estimatedHeight}px` }"
    ></div>
  </div>
</template>
