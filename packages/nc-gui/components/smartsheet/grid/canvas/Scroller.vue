<script lang="ts" setup>
defineProps({
  width: {
    type: Number,
    required: true,
  },
  height: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['scroll'])

const wrapperRef = ref()
const contentWrapper = ref()
const verticalScrollbar = ref(null)
const horizontalScrollbar = ref(null)

const scrollTop = ref(0)
const scrollLeft = ref(0)
const isDragging = ref(false)
const dragStartPosition = ref(0)
const dragStartScroll = ref(0)
const currentDragAxis = ref(null)
const lastTouchY = ref(0)
const lastTouchX = ref(0)

const isScrollbarVisible = ref(true)
const scrollbarTimer = ref(null)

const showScrollbars = () => {
  isScrollbarVisible.value = true

  if (scrollbarTimer.value) {
    clearTimeout(scrollbarTimer.value)
  }

  scrollbarTimer.value = setTimeout(() => {
    isScrollbarVisible.value = false
  }, 2000)
}

const showVerticalScrollbar = computed(() => {
  if (!contentWrapper.value || !wrapperRef.value) return false
  return contentWrapper.value.scrollHeight > wrapperRef.value.clientHeight
})

const showHorizontalScrollbar = computed(() => {
  if (!contentWrapper.value || !wrapperRef.value) return false
  return contentWrapper.value.scrollWidth > wrapperRef.value.clientWidth
})

const verticalThumbHeight = computed(() => {
  if (!contentWrapper.value || !wrapperRef.value) return 100
  const ratio = wrapperRef.value.clientHeight / contentWrapper.value.scrollHeight
  return Math.max(ratio * 100, 10)
})

const horizontalThumbWidth = computed(() => {
  if (!contentWrapper.value || !wrapperRef.value) return 100
  const ratio = wrapperRef.value.clientWidth / contentWrapper.value.scrollWidth
  return Math.max(ratio * 100, 10)
})

const verticalThumbPosition = computed(() => {
  if (!contentWrapper.value || !wrapperRef.value) return 0
  const availableSpace =
    wrapperRef.value.clientHeight - 72 - ((wrapperRef.value.clientHeight - 72) * verticalThumbHeight.value) / 100
  const scrollRatio = scrollTop.value / (contentWrapper.value.scrollHeight - wrapperRef.value.clientHeight)
  return scrollRatio * availableSpace
})

const horizontalThumbPosition = computed(() => {
  if (!contentWrapper.value || !wrapperRef.value) return 0
  const availableSpace =
    wrapperRef.value.clientWidth - 12 - ((wrapperRef.value.clientWidth - 12) * horizontalThumbWidth.value) / 100
  const scrollRatio = scrollLeft.value / (contentWrapper.value.scrollWidth - wrapperRef.value.clientWidth)
  return scrollRatio * availableSpace
})

const updateScroll = (vertical, horizontal) => {
  if (!contentWrapper.value) return

  if (vertical !== undefined) {
    const maxScroll = contentWrapper.value.scrollHeight - wrapperRef.value.clientHeight
    scrollTop.value = Math.max(0, Math.min(vertical, maxScroll))
  }

  if (horizontal !== undefined) {
    const maxScroll = contentWrapper.value.scrollWidth - wrapperRef.value.clientWidth
    scrollLeft.value = Math.max(0, Math.min(horizontal, maxScroll))
  }

  showScrollbars()

  emit('scroll', {
    left: scrollLeft.value,
    top: scrollTop.value,
  })
}

const handleWheel = (e) => {
  e.preventDefault()
  updateScroll(scrollTop.value + e.deltaY, scrollLeft.value + e.deltaX)
}

const startDragging = (axis, event) => {
  event.preventDefault()
  event.stopPropagation()

  isDragging.value = true
  currentDragAxis.value = axis
  dragStartPosition.value = axis === 'vertical' ? event.clientY : event.clientX
  dragStartScroll.value = axis === 'vertical' ? scrollTop.value : scrollLeft.value

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDragging)
}

function handleDrag(event: MouseEvent) {
  if (!isDragging.value) return

  const delta =
    currentDragAxis.value === 'vertical' ? event.clientY - dragStartPosition.value : event.clientX - dragStartPosition.value

  const scrollRatio =
    currentDragAxis.value === 'vertical'
      ? (contentWrapper.value.scrollHeight - wrapperRef.value.clientHeight) /
        (wrapperRef.value.clientHeight - (wrapperRef.value.clientHeight * verticalThumbHeight.value) / 100)
      : (contentWrapper.value.scrollWidth - wrapperRef.value.clientWidth) /
        (wrapperRef.value.clientWidth - (wrapperRef.value.clientWidth * horizontalThumbWidth.value) / 100)

  const newScroll = dragStartScroll.value + delta * scrollRatio

  if (currentDragAxis.value === 'vertical') {
    updateScroll(newScroll, undefined)
  } else {
    updateScroll(undefined, newScroll)
  }
}
function stopDragging() {
  isDragging.value = false
  currentDragAxis.value = null
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDragging)
}

const handleTrackClick = (axis, event) => {
  if (event.target === (axis === 'vertical' ? verticalScrollbar.value : horizontalScrollbar.value)) return

  const rect = event.currentTarget.getBoundingClientRect()
  const clickPosition = axis === 'vertical' ? event.clientY - rect.top : event.clientX - rect.left
  const trackSize = axis === 'vertical' ? rect.height : rect.width

  const scrollRatio = clickPosition / trackSize
  const maxScroll =
    axis === 'vertical'
      ? contentWrapper.value.scrollHeight - wrapperRef.value.clientHeight
      : contentWrapper.value.scrollWidth - wrapperRef.value.clientWidth

  const newScroll = maxScroll * scrollRatio

  if (axis === 'vertical') {
    updateScroll(newScroll, undefined)
  } else {
    updateScroll(undefined, newScroll)
  }
}

const handleTouchStart = (event) => {
  lastTouchY.value = event.touches[0].clientY
  lastTouchX.value = event.touches[0].clientX
}

const handleTouchMove = (event) => {
  const deltaY = lastTouchY.value - event.touches[0].clientY
  const deltaX = lastTouchX.value - event.touches[0].clientX

  lastTouchY.value = event.touches[0].clientY
  lastTouchX.value = event.touches[0].clientX

  updateScroll(scrollTop.value + deltaY, scrollLeft.value + deltaX)
}

const handleTouchEnd = () => {
  lastTouchY.value = 0
  lastTouchX.value = 0
}

const scrollTo = (left, top) => {
  if (left !== undefined) {
    const maxScrollLeft = contentWrapper.value.scrollWidth - wrapperRef.value.clientWidth
    scrollLeft.value = Math.max(0, Math.min(left, maxScrollLeft))
  }

  if (top !== undefined) {
    const maxScrollTop = contentWrapper.value.scrollHeight - wrapperRef.value.clientHeight
    scrollTop.value = Math.max(0, Math.min(top, maxScrollTop))
  }

  showScrollbars()

  emit('scroll', {
    left: scrollLeft.value,
    top: scrollTop.value,
  })
}

onMounted(() => {
  showScrollbars()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDragging)
})

defineExpose({
  scrollTo,
  getScrollPosition: () => ({
    left: scrollLeft.value,
    top: scrollTop.value,
  }),
})
</script>

<template>
  <div ref="wrapperRef" class="relative overflow-hidden" :style="{ width: `${width}px`, height: `${height}px` }">
    <div class="absolute inset-0 overflow-hidden">
      <div
        ref="contentWrapper"
        class="custom-scrollbar-content"
        @wheel="handleWheel"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <slot></slot>
      </div>
    </div>

    <div
      v-show="showVerticalScrollbar"
      :class="{ 'scrollbar-visible': isScrollbarVisible }"
      class="custom-scrollbar-track vertical"
      @click="handleTrackClick('vertical', $event)"
    >
      <div
        ref="verticalScrollbar"
        class="custom-scrollbar-thumb vertical"
        :style="{ height: `${verticalThumbHeight}%`, transform: `translateY(${verticalThumbPosition}px)` }"
        @mousedown="startDragging('vertical', $event)"
      ></div>
    </div>

    <div
      v-show="showHorizontalScrollbar"
      :class="{ 'scrollbar-visible': isScrollbarVisible }"
      class="custom-scrollbar-track horizontal"
      @click="handleTrackClick('horizontal', $event)"
    >
      <div
        ref="horizontalScrollbar"
        class="custom-scrollbar-thumb horizontal"
        :style="{ width: `${horizontalThumbWidth}%`, transform: `translateX(${horizontalThumbPosition}px)` }"
        @mousedown="startDragging('horizontal', $event)"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar-content {
  @apply relative h-full w-full;
  min-width: 100%;
  min-height: 100%;
  will-change: transform;
}

.custom-scrollbar-track {
  opacity: 0;
  transition: opacity 0.3s ease;
  position: absolute;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  z-index: 100;
}

.custom-scroller:hover .custom-scrollbar-track,
.custom-scrollbar-track.scrollbar-visible {
  opacity: 1;
}

.custom-scrollbar-track.vertical {
  top: 34px;
  right: 4px;
  bottom: 38px;
  width: 8px;
}

.custom-scrollbar-track.horizontal {
  left: 4px;
  right: 18px;
  bottom: 36px;
  height: 8px;
}

.custom-scrollbar-thumb {
  position: absolute;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  will-change: transform;
}

.custom-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.6);
}

.custom-scrollbar-thumb.vertical {
  width: 100%;
}

.custom-scrollbar-thumb.horizontal {
  height: 100%;
}
</style>
