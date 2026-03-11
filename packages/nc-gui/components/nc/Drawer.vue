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
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: '85dvh',
  placement: 'bottom',
  closable: false,
  maskClosable: true,
  destroyOnClose: true,
  wrapClassName: '',
  bodyStyle: () => ({}),
  showDragHandle: true,
  swipeToClose: true,
  swipeThreshold: 80,
})

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const slots = useSlots()

// ── Swipe-to-close ──────────────────────────────────────────────────
const drawerContentRef = ref<HTMLElement | null>(null)
const startY = ref(0)
const currentTranslateY = ref(0)
const isDragging = ref(false)

function getContentWrapper(): HTMLElement | null {
  return drawerContentRef.value?.closest('.ant-drawer-content-wrapper') as HTMLElement | null
}

function onTouchStart(e: TouchEvent) {
  if (!props.swipeToClose) return
  startY.value = e.touches[0].clientY
  currentTranslateY.value = 0
  isDragging.value = true

  const wrapper = getContentWrapper()
  if (wrapper) {
    wrapper.style.transition = 'none'
  }
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return

  const delta = e.touches[0].clientY - startY.value

  // Only allow dragging downward
  currentTranslateY.value = Math.max(0, delta)

  const wrapper = getContentWrapper()
  if (wrapper) {
    wrapper.style.transform = `translateY(${currentTranslateY.value}px)`
  }
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  const wrapper = getContentWrapper()

  if (currentTranslateY.value > props.swipeThreshold) {
    // Swiped enough — close
    visible.value = false
    currentTranslateY.value = 0

    setTimeout(() => {
      if (wrapper) {
        wrapper.style.transition = ''
        wrapper.style.transform = ''
      }
    }, 300)
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

const wrapClassNameComputed = computed(() => {
  let className = 'nc-drawer-wrapper'
  if (props.wrapClassName) {
    className += ` ${props.wrapClassName}`
  }
  return className
})

onMounted(() => {
  console.log('on mounted', visible.value)
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
    <div ref="drawerContentRef" class="nc-drawer-content flex flex-col h-full">
      <!-- Drag handle for swipe-to-close -->
      <div
        v-if="showDragHandle"
        class="nc-drawer-drag-handle flex-none"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <div class="nc-drawer-drag-indicator" />
      </div>

      <!-- Header -->
      <div v-if="slots.header || title" class="nc-drawer-header flex-none">
        <slot name="header">
          <div class="text-sm font-semibold text-nc-content-gray">{{ title }}</div>
        </slot>
      </div>

      <!-- Body -->
      <div class="nc-drawer-body flex-1 min-h-0 overflow-y-auto nc-scrollbar-thin">
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
    @apply !rounded-t-3xl overflow-hidden;
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
