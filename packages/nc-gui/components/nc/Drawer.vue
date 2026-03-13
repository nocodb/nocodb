<script lang="ts" setup>
import { Drawer } from 'ant-design-vue'

interface Props {
  visible: boolean
  title?: string
  height?: string
  placement?: 'bottom' | 'top' | 'left' | 'right'
  closable?: boolean
  maskClosable?: boolean
  destroyOnClose?: boolean
  wrapClassName?: string
  bodyStyle?: Record<string, any>
  showDragHandle?: boolean
  swipeToClose?: boolean
  swipeThreshold?: number
  scrollableBody?: boolean
  bodyClassName?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 'auto',
  placement: 'bottom',
  closable: false,
  maskClosable: true,
  destroyOnClose: true,
  wrapClassName: '',
  bodyStyle: () => ({}),
  showDragHandle: true,
  swipeToClose: true,
  swipeThreshold: 150,
  scrollableBody: true,
  bodyClassName: '',
})

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const slots = useSlots()

// ── Swipe-to-close (scroll-aware, works on entire drawer) ───────────
const drawerContentRef = ref<HTMLElement | null>(null)
const startY = ref(0)
const currentTranslateY = ref(0)
const isDragging = ref(false)

// Track the scrollable element under the touch and whether dismiss mode is active.
// `scrollTarget` is resolved once per touch; `isDismissing` locks in after the
// first touchmove confirms a downward gesture on an element at scrollTop 0.
let scrollTarget: HTMLElement | null = null
let isDismissing = false
// Track whether gesture direction has been determined to avoid re-evaluating
let gestureResolved = false

function getContentWrapper(): HTMLElement | null {
  return drawerContentRef.value?.closest('.ant-drawer-content-wrapper') as HTMLElement | null
}

/**
 * Walk up from `el` to find the nearest vertically-scrollable ancestor
 * that is still inside the drawer content. Returns null if none found.
 */
function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  const boundary = drawerContentRef.value
  let current = el

  while (current && current !== boundary) {
    // Element is scrollable if it has overflow content and CSS allows scrolling
    if (current.scrollHeight > current.clientHeight) {
      const style = window.getComputedStyle(current)
      const overflowY = style.overflowY

      if (overflowY === 'auto' || overflowY === 'scroll') {
        return current
      }
    }
    current = current.parentElement
  }

  return null
}

function onContentTouchStart(e: TouchEvent) {
  if (!props.swipeToClose) return

  startY.value = e.touches[0].clientY
  currentTranslateY.value = 0
  isDragging.value = true
  isDismissing = false
  gestureResolved = false

  // Resolve the scrollable ancestor once per touch — avoids repeated DOM walks
  scrollTarget = findScrollableAncestor(e.target as HTMLElement)

  const wrapper = getContentWrapper()
  if (wrapper) {
    wrapper.style.transition = 'none'
  }
}

function onContentTouchMove(e: TouchEvent) {
  if (!isDragging.value) return

  const currentY = e.touches[0].clientY
  const delta = currentY - startY.value

  // First movement — decide if this is a dismiss gesture or a normal scroll
  if (!gestureResolved) {
    gestureResolved = true

    // Swiping up → never a dismiss, let native scroll handle it
    if (delta < 0) {
      isDragging.value = false
      return
    }

    // Swiping down — only dismiss if scrollable target is at the top (or there's none)
    const isAtTop = !scrollTarget || scrollTarget.scrollTop <= 0
    if (!isAtTop) {
      // Still has scroll room upward — let native scroll handle it
      isDragging.value = false
      return
    }

    // Lock into dismiss mode
    isDismissing = true
  }

  if (!isDismissing) return

  // Prevent native scroll while we're dragging the sheet down
  e.preventDefault()

  currentTranslateY.value = Math.max(0, delta)

  const wrapper = getContentWrapper()
  if (wrapper) {
    wrapper.style.transform = `translateY(${currentTranslateY.value}px)`
  }
}

function onContentTouchEnd() {
  if (!isDragging.value && !isDismissing) return

  const wasDismissing = isDismissing
  isDragging.value = false
  isDismissing = false
  gestureResolved = false
  scrollTarget = null

  if (!wasDismissing) return

  const wrapper = getContentWrapper()

  if (currentTranslateY.value > props.swipeThreshold) {
    // Swiped enough — animate off-screen, then close
    currentTranslateY.value = 0

    if (wrapper) {
      wrapper.style.transition = 'transform 0.25s ease-out'
      wrapper.style.transform = 'translateY(100%)'
    }

    setTimeout(() => {
      visible.value = false

      if (wrapper) {
        wrapper.style.transition = ''
        wrapper.style.transform = ''
      }
    }, 250)
  } else {
    // Snap back
    currentTranslateY.value = 0
    if (wrapper) {
      wrapper.style.transition = 'transform 0.2s ease-out'
      wrapper.style.transform = ''

      setTimeout(() => {
        wrapper.style.transition = ''
      }, 200)
    }
  }
}

// ── Scroll-aware fade ────────────────────────────────────────────────
const drawerBodyRef = ref<HTMLElement | null>(null)
const canScrollUp = ref(false)
const canScrollDown = ref(false)

const scrollFadeClass = computed(() => {
  if (canScrollUp.value && canScrollDown.value) return 'nc-scroll-fade'
  if (canScrollUp.value) return 'nc-scroll-fade-top'
  if (canScrollDown.value) return 'nc-scroll-fade-bottom'
  return ''
})

function updateScrollFade() {
  const el = drawerBodyRef.value
  if (!el) return

  canScrollUp.value = el.scrollTop > 0
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 1
}

const debouncedUpdateScrollFade = useDebounceFn(updateScrollFade, 16)

watch(visible, (val) => {
  if (val) {
    nextTick(() => updateScrollFade())
  }
})

const wrapClassNameComputed = computed(() => {
  let className = 'nc-drawer-wrapper'
  if (props.wrapClassName) {
    className += ` ${props.wrapClassName}`
  }
  return className
})

onMounted(() => {
  updateScrollFade()
})
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :placement="placement"
    :closable="closable"
    :mask-closable="maskClosable"
    :destroy-on-close="destroyOnClose"
    :height="height"
    :class="wrapClassNameComputed"
    :body-style="{ padding: 0, ...bodyStyle }"
    :footer="null"
    class="nc-drawer"
    @keydown.esc="visible = false"
  >
    <div
      ref="drawerContentRef"
      class="nc-drawer-content flex flex-col h-full"
      @touchstart="onContentTouchStart"
      @touchmove="onContentTouchMove"
      @touchend="onContentTouchEnd"
    >
      <!-- Drag handle -->
      <div v-if="showDragHandle" class="nc-drawer-drag-handle flex-none">
        <div class="nc-drawer-drag-indicator" />
      </div>

      <!-- Header -->
      <div v-if="slots.header || title" class="nc-drawer-header flex-none">
        <slot name="header">
          <div class="text-sm font-semibold text-nc-content-gray">{{ title }}</div>
        </slot>
      </div>

      <!-- Body -->
      <div
        ref="drawerBodyRef"
        class="nc-drawer-body flex-1 min-h-0"
        :class="[scrollableBody ? 'overflow-y-auto nc-scrollbar-thin' : 'overflow-hidden', scrollableBody ? scrollFadeClass : '', bodyClassName]"
        @scroll="scrollableBody ? debouncedUpdateScrollFade() : undefined"
      >
        <slot />
      </div>

      <!-- Footer -->
      <div v-if="slots.footer" class="nc-drawer-footer flex-none">
        <slot name="footer" />
      </div>
    </div>
  </Drawer>
</template>

<style lang="scss">
.nc-drawer-wrapper {
  .ant-drawer-content-wrapper {
    @apply !rounded-t-3xl overflow-hidden dark:border-t-1 dark:border-nc-border-gray-medium;
  }

  .ant-drawer-content {
    @apply !rounded-t-3xl !p-0;
  }

  .ant-drawer-body {
    @apply !p-0;
  }
}

</style>

<style lang="scss" scoped>
.nc-drawer-content {
  @apply bg-nc-bg-default;
}

.nc-drawer-drag-handle {
  @apply flex items-center justify-center py-2 cursor-grab active:cursor-grabbing;
}

.nc-drawer-drag-indicator {
  @apply w-9 h-1 rounded-full bg-nc-bg-gray-dark;
}

.nc-drawer-header {
  @apply px-4 pb-2;
}

.nc-drawer-body {
  @apply px-4 pb-4;
}

.nc-drawer-footer {
  @apply px-4 py-3 border-t-1 border-nc-border-gray-medium;
}
</style>
