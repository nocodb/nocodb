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

const props = defineProps<{
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
  deleteNode: () => void
  selected: boolean
  editor: any
  getPos: () => number
}>()

const { buildProxyUrl } = useDocumentImageUpload()
const { t } = useI18n()

// --- Resolved image source ---
// With cookie auth, images with an `id` (FileReference) use the proxy URL directly as <img src>.
// The browser sends the nc_token cookie automatically — no fetch+blob needed.
const resolvedSrc = computed(() => {
  const { id, src } = props.node.attrs
  if (id) return buildProxyUrl(id)
  if (src) return src // blob preview during upload or external URL
  return ''
})

const isLoading = computed(() => {
  // Only show loading during upload (no path yet, no src yet).
  // path is set when upload completes; id is set later when doc is saved.
  const { path, src } = props.node.attrs
  return !path && !src
})

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

/** SW (bottom-left) resize — inverted delta direction. */
// Track SW closures for cleanup
let swMoveHandler: ((ev: MouseEvent) => void) | null = null
let swUpHandler: (() => void) | null = null

const onResizeStartSW = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = imageRef.value?.getBoundingClientRect().width || 0

  swMoveHandler = (ev: MouseEvent) => {
    const delta = resizeStartX.value - ev.clientX
    const newWidth = Math.max(MIN_WIDTH, Math.round(resizeStartWidth.value + delta))
    const editorBody = props.editor.view.dom.closest('.nc-doc-editor-body')
    const maxWidth = editorBody ? editorBody.clientWidth : 800
    props.updateAttributes({ width: Math.min(newWidth, maxWidth) })
  }

  swUpHandler = () => {
    isResizing.value = false
    if (swMoveHandler) document.removeEventListener('mousemove', swMoveHandler)
    if (swUpHandler) document.removeEventListener('mouseup', swUpHandler)
    swMoveHandler = null
    swUpHandler = null
  }

  document.addEventListener('mousemove', swMoveHandler)
  document.addEventListener('mouseup', swUpHandler)
}

// Clean up on unmount
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  if (swMoveHandler) document.removeEventListener('mousemove', swMoveHandler)
  if (swUpHandler) document.removeEventListener('mouseup', swUpHandler)
})

// --- Caption ---
const captionText = ref(props.node.attrs.caption || '')
const captionInputRef = ref<HTMLInputElement | null>(null)
// Flag to suppress blur handler when Enter already handled save + focus
const captionSavedByKeydown = ref(false)

const hasCaption = computed(() => !!props.node.attrs.caption)

/** Save caption and move editor cursor after this image node. */
const saveCaptionAndDeselect = (focus: boolean) => {
  const trimmed = captionText.value.trim()
  props.updateAttributes({ caption: trimmed || null })
  try {
    const pos = props.getPos() + props.node.nodeSize
    if (focus) {
      props.editor.chain().focus(pos).run()
    } else {
      props.editor.commands.setTextSelection(pos)
    }
  } catch {
    // getPos() may throw if the node was deleted (e.g. toolbar delete while caption focused)
  }
}

const onCaptionBlur = () => {
  // Skip if Enter keydown already saved + moved cursor
  if (captionSavedByKeydown.value) {
    captionSavedByKeydown.value = false
    return
  }
  saveCaptionAndDeselect(false)
}

const onCaptionKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    captionSavedByKeydown.value = true
    saveCaptionAndDeselect(true)
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    captionText.value = props.node.attrs.caption || ''
    captionSavedByKeydown.value = true
    saveCaptionAndDeselect(false)
  }
}

watch(
  () => props.node.attrs.caption,
  (val) => {
    captionText.value = val || ''
  },
)

// --- Download ---
const downloadImage = async () => {
  const { id } = props.node.attrs
  if (!id && !resolvedSrc.value) return

  try {
    // Fetch via proxy URL with credentials (cookie) — needed for download
    // because <a download> doesn't work cross-origin
    const url = id ? buildProxyUrl(id) : resolvedSrc.value
    const response = await fetch(url, { credentials: 'include' })
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = props.node.attrs.alt || 'image'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  } catch {
    // Fallback: open in new tab
    window.open(resolvedSrc.value, '_blank')
  }
}

// --- Deselect when clicking empty space in the wrapper (outside image/caption/toolbar) ---
const onWrapperClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('.nc-doc-image-container') || target.closest('.nc-doc-image-toolbar')) return
  // Click landed on empty wrapper space — deselect
  const pos = props.getPos() + props.node.nodeSize
  props.editor.commands.setTextSelection(pos)
}

// --- Toolbar visibility ---
const isEditable = computed(() => props.editor?.isEditable)
const showToolbar = computed(() => props.selected && !isResizing.value && isEditable.value)
</script>

<template>
  <NodeViewWrapper
    class="nc-doc-image-wrapper"
    :class="[alignClass, { 'is-selected': selected }]"
    as="div"
    @click="onWrapperClick"
  >
    <!-- Floating toolbar -->
    <div v-if="showToolbar" class="nc-doc-image-toolbar" contenteditable="false">
      <button
        class="nc-doc-image-toolbar-btn"
        :class="{ active: node.attrs.align === 'left' }"
        :title="t('labels.alignLeft')"
        @click="setAlign('left')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="17" y1="10" x2="3" y2="10" />
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="14" x2="3" y2="14" />
          <line x1="17" y1="18" x2="3" y2="18" />
        </svg>
      </button>
      <button
        class="nc-doc-image-toolbar-btn"
        :class="{ active: node.attrs.align === 'center' || !node.attrs.align }"
        :title="t('labels.alignCenter')"
        @click="setAlign('center')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="10" x2="6" y2="10" />
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="14" x2="3" y2="14" />
          <line x1="18" y1="18" x2="6" y2="18" />
        </svg>
      </button>
      <button
        class="nc-doc-image-toolbar-btn"
        :class="{ active: node.attrs.align === 'right' }"
        :title="t('labels.alignRight')"
        @click="setAlign('right')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="21" y1="10" x2="7" y2="10" />
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="14" x2="3" y2="14" />
          <line x1="21" y1="18" x2="7" y2="18" />
        </svg>
      </button>
      <div class="nc-doc-image-toolbar-divider" />
      <button class="nc-doc-image-toolbar-btn" :title="t('labels.downloadImage')" @click="downloadImage">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      <div class="nc-doc-image-toolbar-divider" />
      <button class="nc-doc-image-toolbar-btn nc-doc-image-toolbar-delete" :title="t('labels.deleteImage')" @click="deleteNode">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
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

      <!-- Resize handles (visible when selected + editable) -->
      <template v-if="selected && resolvedSrc && isEditable">
        <div class="nc-doc-image-resize-handle nc-resize-se" @mousedown="onResizeStart" />
        <div class="nc-doc-image-resize-handle nc-resize-sw" @mousedown="onResizeStartSW" />
      </template>

      <!-- Caption -->
      <input
        v-if="selected && resolvedSrc && isEditable"
        ref="captionInputRef"
        v-model="captionText"
        class="nc-doc-image-caption nc-doc-image-caption-input"
        data-testid="nc-doc-image-caption"
        :placeholder="t('placeholder.writeCaption')"
        contenteditable="false"
        @blur="onCaptionBlur"
        @keydown="onCaptionKeydown"
      />
      <div v-else-if="hasCaption" class="nc-doc-image-caption">
        {{ node.attrs.caption }}
      </div>
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.nc-doc-image-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0.75em 0;

  &.nc-doc-image-align-left {
    align-items: flex-start;
  }
  &.nc-doc-image-align-center {
    align-items: center;
  }
  &.nc-doc-image-align-right {
    align-items: flex-end;
  }

  &.is-selected .nc-doc-image-container {
    outline: 1px solid var(--nc-fill-primary);
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
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

// --- Resize handles ---
.nc-doc-image-resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-fill-primary);
  border-radius: 1px;
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

// --- Caption ---
.nc-doc-image-caption {
  width: 100%;
  text-align: center;
  font-size: 13px;
  font-style: italic;
  color: var(--nc-content-gray-muted);
  margin-top: 6px;
  line-height: 1.4;
}

.nc-doc-image-caption-input {
  border: none;
  outline: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
  cursor: text;

  &::placeholder {
    color: var(--nc-content-gray-muted);
    font-style: italic;
    opacity: 0.7;
  }
}
</style>
