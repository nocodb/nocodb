<script setup lang="ts">
/**
 * NodeView component for embedded URL previews (YouTube, Vimeo, etc.).
 *
 * Renders an iframe with the embed URL, wrapped in a responsive container.
 * Default: 16:9 aspect ratio at full width.
 *
 * Users can resize via drag handles (visible on hover/selection):
 * - Bottom handle → height (persisted in px)
 * - Left / Right handles → width (persisted as %, centered with auto margin)
 *
 * Custom dimensions are stored as node attributes so they survive save/reload.
 * Shows a delete button on hover/selection.
 */
import { NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps<{
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
  deleteNode: () => void
  selected: boolean
  editor: any
}>()

const embedSrc = computed(() => {
  const src = props.node.attrs.src || ''
  // Only allow http(s) URLs — block javascript:, data:, etc.
  if (src && !/^https?:\/\//i.test(src)) return ''
  return src
})

const customHeight = computed(() => props.node.attrs.height as number | null)

const customWidth = computed(() => props.node.attrs.width as number | null)

// --- Resize drag state ---
const isResizing = ref(false)
const resizeAxis = ref<'height' | 'width'>('height')
const resizeStartPos = ref(0)
const resizeStartSize = ref(0)
const resizeSide = ref<'left' | 'right'>('right')
const cardRef = ref<HTMLElement>()
const wrapperRef = ref<HTMLElement>()
const liveHeight = ref<number | null>(null)
const liveWidthPct = ref<number | null>(null)

/** Lock cursor on <html> and disable text selection during drag */
const lockCursor = (cursor: string) => {
  document.documentElement.style.cursor = cursor
  document.body.style.userSelect = 'none'
}

const unlockCursor = () => {
  document.documentElement.style.cursor = ''
  document.body.style.userSelect = ''
}

const onResizeHeightStart = (e: MouseEvent) => {
  e.preventDefault()
  isResizing.value = true
  resizeAxis.value = 'height'
  resizeStartPos.value = e.clientY
  resizeStartSize.value = wrapperRef.value?.getBoundingClientRect().height || 0
  lockCursor('row-resize')
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

const onResizeWidthStart = (e: MouseEvent, side: 'left' | 'right') => {
  e.preventDefault()
  isResizing.value = true
  resizeAxis.value = 'width'
  resizeSide.value = side
  resizeStartPos.value = e.clientX
  resizeStartSize.value = cardRef.value?.getBoundingClientRect().width || 0
  lockCursor('col-resize')
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return

  if (resizeAxis.value === 'height') {
    const delta = e.clientY - resizeStartPos.value
    liveHeight.value = Math.max(100, resizeStartSize.value + delta)
  } else {
    const delta = e.clientX - resizeStartPos.value
    // Left handle: drag left = wider, drag right = narrower (opposite of right handle)
    const sign = resizeSide.value === 'right' ? 1 : -1
    // Embed is centered, so width change is 2× the single-side delta
    const newWidth = resizeStartSize.value + delta * sign * 2

    const parentWidth = cardRef.value?.parentElement?.getBoundingClientRect().width
    if (parentWidth) {
      liveWidthPct.value = Math.round(Math.max(20, Math.min(100, (newWidth / parentWidth) * 100)))
    }
  }
}

const onResizeEnd = () => {
  const updates: Record<string, any> = {}

  if (resizeAxis.value === 'height' && liveHeight.value) {
    updates.height = Math.round(liveHeight.value)
  }
  if (resizeAxis.value === 'width' && liveWidthPct.value) {
    // 100% = full width → clear the attribute (null reverts to default)
    updates.width = liveWidthPct.value === 100 ? null : liveWidthPct.value
  }

  if (Object.keys(updates).length) {
    props.updateAttributes(updates)
  }

  isResizing.value = false
  liveHeight.value = null
  liveWidthPct.value = null
  unlockCursor()
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  unlockCursor()
})

// --- Computed styles ---

/** Card width + centering when user has resized narrower than 100% */
const cardStyle = computed(() => {
  const w = liveWidthPct.value || customWidth.value
  if (w && w < 100) {
    return { width: `${w}%`, margin: '0 auto' }
  }
  return {}
})

/** Iframe wrapper: fixed height (user-set) or 16:9 padding-bottom (default) */
const iframeWrapperStyle = computed(() => {
  const h = liveHeight.value || customHeight.value
  if (h) {
    return { height: `${h}px` }
  }
  return { paddingBottom: '56.25%' }
})

/** When height is explicit, the iframe uses static positioning instead of absolute */
const isFixedHeight = computed(() => !!(liveHeight.value || customHeight.value))
</script>

<template>
  <NodeViewWrapper class="nc-embed-wrapper" data-drag-handle data-testid="nc-doc-embed">
    <div ref="cardRef" class="nc-embed-card" :class="{ 'nc-embed-selected': selected }" :style="cardStyle">
      <!-- Left width-resize handle -->
      <div
        v-if="editor?.isEditable"
        class="nc-embed-resize-side nc-embed-resize-left"
        @mousedown="onResizeWidthStart($event, 'left')"
      >
        <div class="nc-embed-resize-side-bar" />
      </div>

      <!-- Iframe container -->
      <div ref="wrapperRef" class="nc-embed-iframe-wrapper" :style="iframeWrapperStyle">
        <iframe
          v-if="embedSrc"
          :src="embedSrc"
          class="nc-embed-iframe"
          :class="{ 'nc-embed-iframe-fixed': isFixedHeight }"
          frameborder="0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />

        <!-- Transparent overlay during resize — prevents iframe from stealing mouse events -->
        <div v-if="isResizing" class="nc-embed-resize-overlay" />
      </div>

      <!-- Right width-resize handle -->
      <div
        v-if="editor?.isEditable"
        class="nc-embed-resize-side nc-embed-resize-right"
        @mousedown="onResizeWidthStart($event, 'right')"
      >
        <div class="nc-embed-resize-side-bar" />
      </div>

      <!-- Delete button — floating top-right on hover -->
      <button v-if="editor?.isEditable" class="nc-embed-delete" @click.stop="deleteNode">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <!-- Bottom height-resize handle -->
      <div v-if="editor?.isEditable" class="nc-embed-resize-handle" @mousedown="onResizeHeightStart">
        <div class="nc-embed-resize-bar" />
      </div>
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
// Transparent overlay covering the iframe during drag — prevents the iframe
// from capturing pointer events which would interrupt resize tracking.
.nc-embed-resize-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
}

// --- Bottom (height) handle ---
.nc-embed-resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 2;
}

.nc-embed-card:hover .nc-embed-resize-handle,
.nc-embed-card.nc-embed-selected .nc-embed-resize-handle {
  opacity: 1;
}

.nc-embed-resize-bar {
  width: 48px;
  height: 4px;
  border-radius: 2px;
  background: var(--nc-fill-primary);
  opacity: 0.5;
  transition: opacity 0.15s;
}

.nc-embed-resize-handle:hover .nc-embed-resize-bar {
  opacity: 0.8;
}

// --- Side (width) handles ---
.nc-embed-resize-side {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 2;
}

.nc-embed-resize-left {
  left: -6px;
}

.nc-embed-resize-right {
  right: -6px;
}

.nc-embed-card:hover .nc-embed-resize-side,
.nc-embed-card.nc-embed-selected .nc-embed-resize-side {
  opacity: 1;
}

.nc-embed-resize-side-bar {
  width: 4px;
  height: 48px;
  border-radius: 2px;
  background: var(--nc-fill-primary);
  opacity: 0.5;
  transition: opacity 0.15s;
}

.nc-embed-resize-side:hover .nc-embed-resize-side-bar {
  opacity: 0.8;
}
</style>
