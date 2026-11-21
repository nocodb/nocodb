<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const MIN_WIDTH = 48

const imageRef = ref<HTMLImageElement>()

// Width while dragging; written to the node once on release, so one drag is one undo step
const dragWidth = ref<number | null>(null)

const width = computed<number | null>(() => dragWidth.value ?? props.node.attrs.width ?? null)

const showHandles = computed(() => props.editor.isEditable && (props.selected || dragWidth.value !== null))

let stopDrag: (() => void) | null = null

/** `direction` is 1 for the right handle, -1 for the left one. */
function onResizeStart(e: PointerEvent, direction: 1 | -1) {
  e.preventDefault()
  e.stopPropagation()

  const startX = e.clientX
  const startWidth = imageRef.value?.getBoundingClientRect().width ?? 0
  const maxWidth = (props.editor.view.dom as HTMLElement).clientWidth || Infinity

  const onMove = (ev: PointerEvent) => {
    const next = Math.round(startWidth + direction * (ev.clientX - startX))
    dragWidth.value = Math.min(Math.max(next, MIN_WIDTH), maxWidth)
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    stopDrag = null

    if (dragWidth.value !== null && dragWidth.value !== props.node.attrs.width) {
      props.updateAttributes({ width: dragWidth.value })
    }
    dragWidth.value = null
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  stopDrag = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
}

// The image can go away mid-drag (a co-editor deletes it, the cell closes)
onBeforeUnmount(() => stopDrag?.())
</script>

<template>
  <NodeViewWrapper class="nc-rich-image" :class="{ 'is-selected': selected && editor.isEditable }">
    <span class="nc-rich-image-frame" :style="width ? { width: `${width}px` } : undefined">
      <img
        ref="imageRef"
        :src="node.attrs.src"
        :alt="node.attrs.alt || undefined"
        :title="node.attrs.title || undefined"
        draggable="false"
      />
      <template v-if="showHandles">
        <span class="nc-rich-image-handle nc-rich-image-handle-left" @pointerdown="onResizeStart($event, -1)" />
        <span class="nc-rich-image-handle nc-rich-image-handle-right" @pointerdown="onResizeStart($event, 1)" />
      </template>
    </span>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.nc-rich-image-frame {
  @apply relative inline-block max-w-full align-top;

  img {
    @apply block max-w-full;
  }

  &[style] img {
    @apply w-full;
  }
}

.nc-rich-image.is-selected .nc-rich-image-frame {
  outline: 2px solid var(--nc-border-brand);
  outline-offset: 1px;
}

.nc-rich-image-handle {
  @apply absolute bottom-1 w-2.5 h-2.5 rounded-sm;

  // A bigger hit area on touch screens
  @media (pointer: coarse) {
    @apply w-4 h-4;
  }

  background: var(--nc-bg-default);
  border: 1.5px solid var(--nc-border-brand);
  touch-action: none;
}

.nc-rich-image-handle-left {
  @apply left-1 cursor-sw-resize;
}

.nc-rich-image-handle-right {
  @apply right-1 cursor-se-resize;
}
</style>
