<script setup lang="ts">
import { useEventListener, useResizeObserver } from '@vueuse/core'
import type { CommentAnnotationRegion } from 'nocodb-sdk'
import { CommentAnnotationRegionType } from 'nocodb-sdk'
import type { AnnotationDraft, AnnotationMarker } from '~/composables/useImageAnnotations'

interface Props {
  srcs: string[]
  alt?: string
  objectFit?: string
  controls?: boolean
  isCellPreview?: boolean
  imageClass?: string
  /** Enables the image-annotation overlay (markers + draw interactions). */
  annotatable?: boolean
  markers?: AnnotationMarker[]
  draft?: AnnotationDraft | null
  activeId?: string | null
  hoveredId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  isCellPreview: true,
  imageClass: '',
  annotatable: false,
  markers: () => [],
  draft: null,
  activeId: null,
  hoveredId: null,
})

const emit = defineEmits(['error', 'createAnnotation', 'hoverAnnotation', 'selectAnnotation'])

const index = ref(0)
const scale = ref(1)
const isDragging = ref(false)
const startPos = ref({ x: 0, y: 0 })
const position = ref({ x: 0, y: 0 })
const containerRef = ref<HTMLDivElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

// Natural (intrinsic) image size + live container size — used to derive the
// object-contain display rect that annotation coordinates are normalized to.
const naturalSize = ref({ w: 0, h: 0 })
const containerSize = ref({ w: 0, h: 0 })

// Live drawing state (only active at scale === 1).
const isAnnotating = ref(false)
const drawStart = ref<{ x: number; y: number } | null>(null)
const drawCurrent = ref<{ x: number; y: number } | null>(null)

const MIN_SCALE = 1
const MAX_SCALE = 4
const ZOOM_STEP = 0.5
const DRAG_THRESHOLD = 0.01 // normalized — below this a drag counts as a point

const transformStyle = computed(() => ({
  transform: `translate(${position.value.x}px, ${position.value.y}px) scale(${scale.value})`,
  transition: isDragging.value || isAnnotating.value ? 'none' : 'transform 0.2s ease-out',
  cursor: props.annotatable && scale.value === 1 ? 'crosshair' : scale.value > 1 ? 'grab' : '',
}))

// object-contain rect of the image within the container (pre-transform, px).
const displayRect = computed(() => {
  const { w: nw, h: nh } = naturalSize.value
  const { w: cw, h: ch } = containerSize.value
  if (!nw || !nh || !cw || !ch) return null

  const fit = Math.min(cw / nw, ch / nh)
  const dw = nw * fit
  const dh = nh * fit
  return { left: (cw - dw) / 2, top: (ch - dh) / 2, width: dw, height: dh }
})

// Map a normalized (0..1) image coord to a transformed container-local pixel,
// matching the <img> transform (origin: container center, then translate).
const toScreen = (nx: number, ny: number) => {
  const rect = displayRect.value
  if (!rect) return { x: 0, y: 0 }
  const cx = containerSize.value.w / 2
  const cy = containerSize.value.h / 2
  const bx = rect.left + nx * rect.width
  const by = rect.top + ny * rect.height
  return {
    x: cx + (bx - cx) * scale.value + position.value.x,
    y: cy + (by - cy) * scale.value + position.value.y,
  }
}

const markerViews = computed(() => {
  const rect = displayRect.value
  if (!rect) return []

  return props.markers.map((m) => {
    const isRect = m.region.type === CommentAnnotationRegionType.RECT
    const topLeft = toScreen(m.region.x, m.region.y)
    return {
      ...m,
      isRect,
      style: isRect
        ? {
            left: `${topLeft.x}px`,
            top: `${topLeft.y}px`,
            width: `${(m.region.w ?? 0) * rect.width * scale.value}px`,
            height: `${(m.region.h ?? 0) * rect.height * scale.value}px`,
          }
        : {
            left: `${topLeft.x}px`,
            top: `${topLeft.y}px`,
          },
    }
  })
})

const drawingRegion = computed<CommentAnnotationRegion | null>(() => {
  if (!isAnnotating.value || !drawStart.value || !drawCurrent.value) return null
  const dx = Math.abs(drawCurrent.value.x - drawStart.value.x)
  const dy = Math.abs(drawCurrent.value.y - drawStart.value.y)
  if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
    return { type: CommentAnnotationRegionType.POINT, x: drawStart.value.x, y: drawStart.value.y }
  }
  return {
    type: CommentAnnotationRegionType.RECT,
    x: Math.min(drawStart.value.x, drawCurrent.value.x),
    y: Math.min(drawStart.value.y, drawCurrent.value.y),
    w: dx,
    h: dy,
  }
})

const drawingStyle = computed(() => {
  const region = drawingRegion.value
  const rect = displayRect.value
  if (!region || !rect || region.type !== CommentAnnotationRegionType.RECT) return null
  const tl = toScreen(region.x, region.y)
  return {
    left: `${tl.x}px`,
    top: `${tl.y}px`,
    width: `${(region.w ?? 0) * rect.width * scale.value}px`,
    height: `${(region.h ?? 0) * rect.height * scale.value}px`,
  }
})

const POPUP_W = 288
const POPUP_H = 168
const VIEW_POPUP_W = 320
const VIEW_POPUP_H = 320
const POPUP_MARGIN = 8
// Clearance between the marker and the popup — large enough that the circle
// pill (badge, ~13px radius incl. border) stays fully visible below the marker.
const POPUP_GAP = 34

// Place a popup of size (w, h) anchored to a region: below the marker when
// there's room, otherwise above; centered horizontally on it; clamped to stay
// fully visible. Reused by the draft popup and the conversation popup.
const placePopup = (region: CommentAnnotationRegion, popupW: number, popupH: number) => {
  const rect = displayRect.value
  if (!rect) return null

  const isRect = region.type === CommentAnnotationRegionType.RECT
  const topY = toScreen(region.x, region.y).y
  const bottomY = isRect ? toScreen(region.x, region.y + (region.h ?? 0)).y : topY
  const centerX = isRect ? toScreen(region.x + (region.w ?? 0) / 2, region.y).x : toScreen(region.x, region.y).x

  let top = bottomY + POPUP_GAP
  if (top + popupH + POPUP_MARGIN > containerSize.value.h) {
    top = topY - POPUP_GAP - popupH
  }
  top = Math.min(Math.max(top, POPUP_MARGIN), Math.max(POPUP_MARGIN, containerSize.value.h - popupH - POPUP_MARGIN))

  const maxLeft = Math.max(POPUP_MARGIN, containerSize.value.w - popupW - POPUP_MARGIN)
  const left = Math.min(Math.max(centerX - popupW / 2, POPUP_MARGIN), maxLeft)

  return { left: `${left}px`, top: `${top}px` }
}

// Outline of the in-progress draft region so the user sees what they're
// commenting on while the popup is open.
const draftRegionStyle = computed(() => {
  const region = props.draft?.region
  const rect = displayRect.value
  if (!region || !rect) return null
  const tl = toScreen(region.x, region.y)
  if (region.type === CommentAnnotationRegionType.RECT) {
    return {
      left: `${tl.x}px`,
      top: `${tl.y}px`,
      width: `${(region.w ?? 0) * rect.width * scale.value}px`,
      height: `${(region.h ?? 0) * rect.height * scale.value}px`,
    }
  }
  return { left: `${tl.x}px`, top: `${tl.y}px` }
})

const draftIsRect = computed(() => props.draft?.region.type === CommentAnnotationRegionType.RECT)

// Draft popup — anchored to the in-progress region.
const draftStyle = computed(() => (props.draft?.region ? placePopup(props.draft.region, POPUP_W, POPUP_H) : null))

// Active conversation popup — anchored to the active marker's region.
const activeMarker = computed(() => (props.activeId ? props.markers.find((m) => m.commentId === props.activeId) ?? null : null))

const activeStyle = computed(() =>
  activeMarker.value && !props.draft ? placePopup(activeMarker.value.region, VIEW_POPUP_W, VIEW_POPUP_H) : null,
)

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

// Convert a client (viewport) coord to a normalized image coord. Only valid at
// scale === 1 (no transform to invert), which is the only time drawing is on.
function clientToNormalized(clientX: number, clientY: number) {
  const rect = displayRect.value
  const containerEl = containerRef.value
  if (!rect || !containerEl) return null
  const cRect = containerEl.getBoundingClientRect()
  const localX = clientX - cRect.left
  const localY = clientY - cRect.top
  return {
    x: clamp01((localX - rect.left) / rect.width),
    y: clamp01((localY - rect.top) / rect.height),
  }
}

const onImageLoad = (e: Event) => {
  const img = e.target as HTMLImageElement
  naturalSize.value = { w: img.naturalWidth, h: img.naturalHeight }
}

const limitDrag = (x: number, y: number) => {
  if (!containerRef.value || !imageRef.value) return { x, y }

  const containerRect = containerRef.value.getBoundingClientRect()
  const imageRect = imageRef.value.getBoundingClientRect()

  const maxX = (imageRect.width * scale.value - containerRect.width) / 8
  const maxY = (imageRect.height * scale.value - containerRect.height) / 8

  return {
    x: Math.max(Math.min(x, maxX), -maxX),
    y: Math.max(Math.min(y, maxY), -maxY),
  }
}

const onError = async () => {
  index.value++
  if (index.value >= props.srcs.length) {
    const isURLExp = await isURLExpired(props.srcs[0])
    if (isURLExp.isExpired) {
      emit('error')
    }
  }
}

const zoom = (direction: 'in' | 'out') => {
  const newScale =
    direction === 'in' ? Math.min(scale.value + ZOOM_STEP, MAX_SCALE) : Math.max(scale.value - ZOOM_STEP, MIN_SCALE)

  scale.value = newScale
  if (newScale === MIN_SCALE) {
    position.value = { x: 0, y: 0 }
  }
}

const startDrag = (clientX: number, clientY: number) => {
  if (scale.value <= 1 || !props.isCellPreview) return
  isDragging.value = true
  startPos.value = {
    x: clientX - position.value.x,
    y: clientY - position.value.y,
  }
}

const drag = (clientX: number, clientY: number) => {
  if (!isDragging.value || !props.isCellPreview) return
  const newPosition = {
    x: clientX - startPos.value.x,
    y: clientY - startPos.value.y,
  }
  position.value = limitDrag(newPosition.x, newPosition.y)
}

const stopDrag = () => {
  isDragging.value = false
}

// ─── annotation drawing ────────────────────────────────────────────────────
const startAnnotate = (clientX: number, clientY: number) => {
  const norm = clientToNormalized(clientX, clientY)
  if (!norm) return
  isAnnotating.value = true
  drawStart.value = norm
  drawCurrent.value = norm
}

const moveAnnotate = (clientX: number, clientY: number) => {
  if (!isAnnotating.value) return
  drawCurrent.value = clientToNormalized(clientX, clientY)
}

const stopAnnotate = () => {
  if (!isAnnotating.value) return
  const region = drawingRegion.value
  isAnnotating.value = false

  if (region) {
    const anchor =
      region.type === CommentAnnotationRegionType.RECT
        ? toScreen(region.x + (region.w ?? 0), region.y)
        : toScreen(region.x, region.y)
    emit('createAnnotation', { region, anchor })
  }

  drawStart.value = null
  drawCurrent.value = null
}

const isAnnotateGesture = () => props.annotatable && scale.value === 1 && props.isCellPreview

const stopPropagationIfScaled = (e: MouseEvent | TouchEvent) => {
  if (scale.value <= 1 || !props.isCellPreview) return
  e.preventDefault()
  e.stopPropagation()
}

useEventListener(window, 'mousemove', (e: MouseEvent) => {
  if (isAnnotating.value) moveAnnotate(e.clientX, e.clientY)
  else drag(e.clientX, e.clientY)
})
useEventListener(window, 'mouseup', () => {
  if (isAnnotating.value) stopAnnotate()
  else stopDrag()
})
useEventListener(window, 'touchmove', (e: TouchEvent) => {
  if (isAnnotating.value) moveAnnotate(e.touches[0].clientX, e.touches[0].clientY)
  else drag(e.touches[0].clientX, e.touches[0].clientY)
})
useEventListener(window, 'touchend', () => {
  if (isAnnotating.value) stopAnnotate()
  else stopDrag()
})

const onMouseDown = (e: MouseEvent) => {
  if (isAnnotateGesture()) {
    e.preventDefault()
    e.stopPropagation()
    startAnnotate(e.clientX, e.clientY)
    return
  }
  stopPropagationIfScaled(e)
  startDrag(e.clientX, e.clientY)
}
const onTouchStart = (e: TouchEvent) => {
  if (props.isCellPreview) {
    e.preventDefault()
  }

  if (isAnnotateGesture()) {
    e.stopPropagation()
    startAnnotate(e.touches[0].clientX, e.touches[0].clientY)
    return
  }
  stopPropagationIfScaled(e)
  startDrag(e.touches[0].clientX, e.touches[0].clientY)
}

useResizeObserver(containerRef, (entries) => {
  const cr = entries[0]?.contentRect
  if (cr) containerSize.value = { w: cr.width, h: cr.height }
})

onMounted(() => {
  if (containerRef.value) {
    containerSize.value = { w: containerRef.value.clientWidth, h: containerRef.value.clientHeight }
  }
})
</script>

<template>
  <div class="relative h-full w-full">
    <div
      ref="containerRef"
      class="h-full w-full overflow-hidden relative"
      :class="{
        'flex items-center justify-center': index >= props.srcs?.length,
      }"
      @mousedown="onMouseDown"
      @touchstart="onTouchStart"
    >
      <img
        v-if="index < props.srcs?.length"
        ref="imageRef"
        :src="props.srcs[index]"
        :alt="props?.alt || ''"
        :style="transformStyle"
        :class="[
          imageClass,
          { '!object-contain': props.objectFit === 'contain' },
          annotatable ? 'w-full h-full object-contain' : 'm-auto h-full max-h-full w-auto object-cover',
        ]"
        class="nc-attachment-image origin-center"
        loading="lazy"
        @load="onImageLoad"
        @error="onError"
      />
      <GeneralIcon v-else icon="ncFileTypeImage" class="flex-none w-6" />

      <!-- Annotation overlay -->
      <div v-if="annotatable" class="nc-annotation-overlay pointer-events-none absolute inset-0 z-10">
        <!-- live draw preview -->
        <div
          v-if="drawingStyle"
          class="nc-annotation-draw-preview absolute border-2 border-nc-border-brand bg-nc-bg-brand/10 rounded"
          :style="drawingStyle"
        />

        <!-- saved markers -->
        <template v-for="m in markerViews" :key="m.commentId">
          <!-- rectangle region -->
          <div
            v-if="m.isRect"
            class="nc-annotation-marker pointer-events-auto absolute cursor-pointer rounded transition-shadow"
            :class="
              activeId === m.commentId || hoveredId === m.commentId
                ? 'border-2 border-nc-fill-primary shadow-[0_0_0_2px_rgba(51,102,255,0.25)]'
                : 'border-2 border-white/80'
            "
            :style="m.style"
            :data-testid="`nc-annotation-marker-${m.label}`"
            @mouseenter="emit('hoverAnnotation', m.commentId)"
            @mouseleave="emit('hoverAnnotation', null)"
            @click.stop="emit('selectAnnotation', m.commentId)"
          >
            <div class="nc-annotation-badge" :class="{ 'nc-annotation-badge-active': activeId === m.commentId }">
              {{ m.label }}
            </div>
          </div>

          <!-- point pin -->
          <div
            v-else
            class="nc-annotation-marker nc-annotation-point pointer-events-auto absolute cursor-pointer"
            :style="m.style"
            :data-testid="`nc-annotation-marker-${m.label}`"
            @mouseenter="emit('hoverAnnotation', m.commentId)"
            @mouseleave="emit('hoverAnnotation', null)"
            @click.stop="emit('selectAnnotation', m.commentId)"
          >
            <div class="nc-annotation-badge" :class="{ 'nc-annotation-badge-active': activeId === m.commentId }">
              {{ m.label }}
            </div>
          </div>
        </template>

        <!-- draft region outline (so the user sees what they're commenting on) -->
        <template v-if="draft && draftRegionStyle">
          <div
            v-if="draftIsRect"
            class="nc-annotation-draft-region absolute rounded border-2 border-nc-fill-primary bg-nc-bg-brand/10"
            :style="draftRegionStyle"
          />
          <div v-else class="nc-annotation-draft-region nc-annotation-point absolute" :style="draftRegionStyle">
            <div class="nc-annotation-badge nc-annotation-badge-active" />
          </div>
        </template>

        <!-- draft popup (positioned here, content injected by parent) -->
        <div v-if="draft && draftStyle" class="nc-annotation-popup pointer-events-auto absolute z-20" :style="draftStyle">
          <slot name="popup" />
        </div>

        <!-- conversation popup for the active marker -->
        <div v-if="!draft && activeStyle" class="nc-annotation-view-popup pointer-events-auto absolute z-20" :style="activeStyle">
          <slot name="viewPopup" />
        </div>
      </div>
    </div>

    <div v-if="controls" class="absolute mx-auto w-full bottom-4 flex items-center justify-center gap-2">
      <button
        class="rounded-full bg-nc-gray-800/70 p-2 text-nc-content-inverted-primary hover:bg-nc-gray-700/70 disabled:opacity-50"
        :disabled="scale >= MAX_SCALE"
        title="Zoom in"
        @click="zoom('in')"
      >
        <GeneralIcon icon="ncZoomIn" class="h-5 w-5" />
      </button>
      <button
        class="rounded-full bg-nc-gray-800/70 p-2 text-nc-content-inverted-primary hover:bg-nc-gray-700/70 disabled:opacity-50"
        :disabled="scale <= MIN_SCALE"
        title="Zoom out"
        @click="zoom('out')"
      >
        <GeneralIcon icon="ncZoomOut" class="h-5 w-5" />
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-annotation-badge {
  @apply absolute -left-2.5 -top-2.5 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-nc-fill-primary text-white text-[11px] font-semibold border-2 border-white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.nc-annotation-point .nc-annotation-badge {
  @apply left-0 top-0 -translate-x-1/2 -translate-y-1/2;
}

.nc-annotation-badge-active {
  @apply ring-2 ring-nc-fill-primary;
}
</style>
