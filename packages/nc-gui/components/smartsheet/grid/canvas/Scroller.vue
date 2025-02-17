<script lang="ts" setup>
const props = defineProps({
  width: {
    type: Number,
    required: true,
  },
  height: {
    type: Number,
    required: true,
  },
  scrollWidth: {
    type: Number,
    default: 0,
  },
  scrollHeight: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['scroll'])

const scrollWidth = toRef(props, 'scrollWidth')

const scrollHeight = toRef(props, 'scrollHeight')

const height = toRef(props, 'height')

const width = toRef(props, 'width')

const wrapperRef = ref()
const contentWrapper = ref()
const verticalScrollbar = ref(null)
const horizontalScrollbar = ref(null)

const scrollTop = ref(0)
const scrollLeft = ref(0)
const isDragging = ref(false)
const dragStartPosition = ref(0)
const dragStartScroll = ref(0)
const currentDragAxis = ref<'vertical' | 'horizontal' | null>(null)
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
  return scrollHeight.value > height.value
})

const showHorizontalScrollbar = computed(() => {
  return scrollWidth.value > width.value
})

const verticalThumbHeight = computed(() => {
  const ratio = height.value / scrollHeight.value
  return Math.max(ratio * 100, 10)
})

const horizontalThumbWidth = computed(() => {
  const ratio = width.value / scrollWidth.value
  return Math.max(ratio * 100, 10)
})

const verticalThumbPosition = computed(() => {
  const availableSpace = height.value - 72 - ((height.value - 72) * verticalThumbHeight.value) / 100
  const scrollRatio = scrollTop.value / (scrollHeight.value - height.value)
  return scrollRatio * availableSpace
})

const horizontalThumbPosition = computed(() => {
  const availableSpace = width.value - 12 - ((width.value - 12) * horizontalThumbWidth.value) / 100
  const scrollRatio = scrollLeft.value / (scrollWidth.value - width.value)
  return scrollRatio * availableSpace
})

const updateScroll = (vertical?: number, horizontal?: number) => {
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

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  updateScroll(scrollTop.value + e.deltaY, scrollLeft.value + e.deltaX)
}

const startDragging = (axis: 'vertical' | 'horizontal', event: DragEvent) => {
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

const handleTrackClick = (axis: 'vertical' | 'horizontal', event: any) => {
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

const scrollTo = ({ left, top }: { left?: number; top?: number }) => {
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
  wrapperRef,
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
