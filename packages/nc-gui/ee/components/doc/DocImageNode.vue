<script setup lang="ts">
/**
 * NodeView component for doc editor images.
 *
 * Responsibilities:
 * - Resolve permanent `path` → displayable signed URL
 * - Render image with width/alignment from node attrs
 * - Resize drag handles on corners
 * - Floating toolbar (alignment + delete) on selection
 */
import { NodeViewWrapper } from '@tiptap/vue-3'
import { useDocumentImageUpload } from '~/ee/composables/useDocumentImageUpload'

const props = defineProps<{
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
  deleteNode: () => void
  selected: boolean
  editor: any
}>()

const { resolveImageSrc } = useDocumentImageUpload()

// --- Resolved image source ---
const resolvedSrc = ref('')
const isLoading = ref(true)

const resolveSrc = () => {
  const { path, src } = props.node.attrs
  if (path) {
    resolvedSrc.value = resolveImageSrc(path)
  } else if (src) {
    // Blob preview during upload or external URL
    resolvedSrc.value = src
  }
  isLoading.value = false
}

// Resolve on mount and when attrs change
onMounted(resolveSrc)

watch(
  () => [props.node.attrs.path, props.node.attrs.src],
  resolveSrc,
)

// --- Alignment ---
const alignClass = computed(() => {
  const align = props.node.attrs.align || 'center'
  return `nc-doc-image-align-${align}`
})

const setAlign = (align: 'left' | 'center' | 'right') => {
  props.updateAttributes({ align })
}

// --- Width ---
const imageWidth = computed(() => {
  const w = props.node.attrs.width
  return w ? `${w}px` : undefined
})

// --- Resize ---
const imageRef = ref<HTMLImageElement | null>(null)
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const MIN_WIDTH = 100

const onResizeStart = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  isResizing.value = true
  resizeStartX.value = e.clientX

  // Get current rendered width of the image
  if (imageRef.value) {
    resizeStartWidth.value = imageRef.value.getBoundingClientRect().width
  }

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return

  const delta = e.clientX - resizeStartX.value
  const newWidth = Math.max(MIN_WIDTH, Math.round(resizeStartWidth.value + delta))

  // Clamp to editor content width
  const editorBody = props.editor.view.dom.closest('.nc-doc-editor-body')
  const maxWidth = editorBody ? editorBody.clientWidth : 800

  props.updateAttributes({ width: Math.min(newWidth, maxWidth) })
}

const onResizeEnd = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

// Clean up on unmount
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})

// --- Toolbar visibility ---
const showToolbar = computed(() => props.selected && !isResizing.value)
</script>

<template>
  <NodeViewWrapper
    class="nc-doc-image-wrapper"
    :class="[alignClass, { 'is-selected': selected }]"
    as="div"
  >
    <!-- Floating toolbar -->
    <div v-if="showToolbar" class="nc-doc-image-toolbar" contenteditable="false">
      <button
        class="nc-doc-image-toolbar-btn"
        :class="{ active: node.attrs.align === 'left' }"
        title="Align left"
        @click="setAlign('left')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>
      </button>
      <button
        class="nc-doc-image-toolbar-btn"
        :class="{ active: node.attrs.align === 'center' || !node.attrs.align }"
        title="Align center"
        @click="setAlign('center')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" /></svg>
      </button>
      <button
        class="nc-doc-image-toolbar-btn"
        :class="{ active: node.attrs.align === 'right' }"
        title="Align right"
        @click="setAlign('right')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" /></svg>
      </button>
      <div class="nc-doc-image-toolbar-divider" />
      <button
        class="nc-doc-image-toolbar-btn nc-doc-image-toolbar-delete"
        title="Delete image"
        @click="deleteNode"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
      </button>
    </div>

    <!-- Image container -->
    <div class="nc-doc-image-container" :style="{ width: imageWidth }">
      <!-- Loading skeleton -->
      <div v-if="isLoading" class="nc-doc-image-skeleton" />

      <!-- Image -->
      <img
        v-else-if="resolvedSrc"
        ref="imageRef"
        :src="resolvedSrc"
        :alt="node.attrs.alt || ''"
        :title="node.attrs.title || ''"
        class="nc-doc-image"
        data-testid="nc-doc-image"
        draggable="false"
      />

      <!-- Resize handles (visible when selected) -->
      <template v-if="selected && resolvedSrc">
        <div class="nc-doc-image-resize-handle nc-resize-se" @mousedown="onResizeStart" />
        <div
          class="nc-doc-image-resize-handle nc-resize-sw"
          @mousedown="(e: MouseEvent) => {
            resizeStartX = e.clientX
            resizeStartWidth = imageRef?.getBoundingClientRect().width || 0
            // Invert delta for SW handle
            isResizing = true
            const onMove = (ev: MouseEvent) => {
              const delta = resizeStartX - ev.clientX
              const newW = Math.max(MIN_WIDTH, Math.round(resizeStartWidth + delta))
              const editorBody = editor.view.dom.closest('.nc-doc-editor-body')
              const maxW = editorBody ? editorBody.clientWidth : 800
              updateAttributes({ width: Math.min(newW, maxW) })
            }
            const onUp = () => {
              isResizing = false
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
            }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
            e.preventDefault()
            e.stopPropagation()
          }"
        />
      </template>
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.nc-doc-image-wrapper {
  position: relative;
  display: flex;
  margin: 0.75em 0;

  &.nc-doc-image-align-left {
    justify-content: flex-start;
  }
  &.nc-doc-image-align-center {
    justify-content: center;
  }
  &.nc-doc-image-align-right {
    justify-content: flex-end;
  }

  &.is-selected .nc-doc-image-container {
    outline: 2px solid var(--nc-fill-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.nc-doc-image-container {
  position: relative;
  max-width: 100%;
  display: inline-block;
}

.nc-doc-image {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.nc-doc-image-skeleton {
  width: 300px;
  height: 200px;
  background: linear-gradient(90deg, var(--nc-bg-gray-light) 25%, var(--nc-bg-gray-medium) 50%, var(--nc-bg-gray-light) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: nc-shimmer 1.5s infinite;
}

@keyframes nc-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// --- Resize handles ---
.nc-doc-image-resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--nc-bg-default);
  border: 2px solid var(--nc-fill-primary);
  border-radius: 2px;
  z-index: 5;

  &.nc-resize-se {
    bottom: -4px;
    right: -4px;
    cursor: nwse-resize;
  }

  &.nc-resize-sw {
    bottom: -4px;
    left: -4px;
    cursor: nesw-resize;
  }
}

// --- Floating toolbar ---
.nc-doc-image-toolbar {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 20;
  white-space: nowrap;
}

.nc-doc-image-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--nc-content-gray-subtle2);
  transition: all 0.15s;

  &:hover {
    background: var(--nc-bg-gray-light);
    color: var(--nc-content-gray);
  }

  &.active {
    background: var(--nc-bg-brand);
    color: var(--nc-fill-primary);
  }
}

.nc-doc-image-toolbar-delete {
  color: var(--nc-content-red-medium);

  &:hover {
    background: var(--nc-bg-coloured-red);
    color: var(--nc-content-red-dark);
  }
}

.nc-doc-image-toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--nc-border-gray-medium);
  margin: 0 2px;
}
</style>
