<script setup lang="ts">
interface Props {
  root?: HTMLElement | null
  /** Placeholder height until the card has been measured once. */
  estimatedHeight: number
}

const props = defineProps<Props>()

// Mount within MOUNT_PX of the viewport, unmount past UNMOUNT_PX: the gap stops
// cards remounting when the user scrolls back and forth.
const MOUNT_PX = 1200

const UNMOUNT_PX = 2400

const el = ref<HTMLElement>()

const isMounted = ref(false)

const measuredHeight = ref<number>()

const root = computed(() => props.root ?? null)

useIntersectionObserver(
  el,
  ([entry]) => {
    if (entry?.isIntersecting) isMounted.value = true
  },
  { root, rootMargin: `${MOUNT_PX}px 0px` },
)

useIntersectionObserver(
  el,
  ([entry]) => {
    // A keyed move detaches the node for a moment and reports it as out of view.
    if (!entry || entry.isIntersecting || !el.value?.isConnected || !entry.boundingClientRect.height) return
    if (isMounted.value) measuredHeight.value = el.value.offsetHeight
    isMounted.value = false
  },
  { root, rootMargin: `${UNMOUNT_PX}px 0px` },
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
