<script setup lang="ts">
interface Props {
  /** Emits `load` only while true; a flip back to true re-emits if still in view. */
  active: boolean
  root?: HTMLElement | null
}

const props = defineProps<Props>()

const emits = defineEmits<{
  load: []
}>()

// Starts loading this far before the trigger scrolls into view.
const PRELOAD_PX = 600

const el = ref<HTMLElement>()

function isInView() {
  if (!el.value) return false

  const rect = el.value.getBoundingClientRect()
  const rootRect = props.root?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }

  return rect.top < rootRect.bottom + PRELOAD_PX && rect.bottom > rootRect.top
}

useIntersectionObserver(
  el,
  ([entry]) => {
    if (entry?.isIntersecting && props.active) emits('load')
  },
  { root: computed(() => props.root ?? null), rootMargin: `0px 0px ${PRELOAD_PX}px 0px` },
)

// The observer only reports changes, so re-measure once the loaded cards are laid out.
watch(
  () => props.active,
  async (active) => {
    if (!active) return
    await nextTick()
    requestAnimationFrame(() => {
      if (props.active && isInView()) emits('load')
    })
  },
)
</script>

<template>
  <div ref="el" class="nc-gallery-load-trigger h-px w-full" aria-hidden="true"></div>
</template>
