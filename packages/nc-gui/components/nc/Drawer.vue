<script setup lang="ts">
interface Props {
  visible: boolean
  title?: string
  placement?: 'bottom' | 'right'
  height?: string
  maskClosable?: boolean
  destroyOnClose?: boolean
  wrapClassName?: string
  bodyClassName?: string
  showDragHandle?: boolean
  panelBodyClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  placement: 'bottom',
  height: 'auto',
  maskClosable: true,
  destroyOnClose: true,
  wrapClassName: '',
  bodyClassName: '',
  showDragHandle: true,
  panelBodyClass: '',
})

const emits = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = useVModel(props, 'visible', emits)

const slots = useSlots()

const drawerContentRef = ref<HTMLElement | null>(null)
const maskRef = ref<HTMLElement | null>(null)

// ─── Render lifecycle state ──────────────────────────────────────────
const shouldRender = ref(false)
const phase = ref<'idle' | 'entering' | 'open' | 'leaving'>('idle')

// ─── Panel navigation ───────────────────────────────────────────────
type DrawerPanel = Parameters<DrawerNav['pushPanel']>[0]

const panelStack = shallowRef<DrawerPanel[]>([])

const pushPanel = (panel: DrawerPanel) => {
  panelStack.value = [...panelStack.value, panel]
}

const popPanel = () => {
  if (panelStack.value.length > 0) {
    panelStack.value = panelStack.value.slice(0, -1)
  }
}

const resetPanels = () => {
  panelStack.value = []
}

const panelDepth = computed(() => panelStack.value.length)

const SPRING_CURVE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const navSliderStyle = computed(() => ({
  transform: `translateX(-${panelDepth.value * 100}%)`,
  transition: `transform 250ms ${SPRING_CURVE}`,
}))

// Provide nav context for child components (e.g. NcSubMenu)
provide(DrawerNavInj, { pushPanel, popPanel })

// ─── Swipe-to-dismiss state ──────────────────────────────────────────
const touchStartY = ref(0)
const currentTranslateY = ref(0)
const isDragging = ref(false)
const isDragHandle = ref(false)

// Velocity tracking for momentum-based dismiss
const lastTouchY = ref(0)
const lastTouchTime = ref(0)
const velocity = ref(0)

const DISMISS_THRESHOLD = 80
const VELOCITY_DISMISS_THRESHOLD = 600
const ANIMATION_DURATION = 300

// ─── Body scroll lock ────────────────────────────────────────────────
const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden'
  document.body.style.touchAction = 'none'
}

const unlockBodyScroll = () => {
  document.body.style.overflow = ''
  document.body.style.touchAction = ''
}

// ─── Helpers ─────────────────────────────────────────────────────────
const isScrollAreaAtTop = (el: EventTarget | null) => {
  if (!el || !(el instanceof HTMLElement)) return true
  return el.scrollTop <= 0
}

const getFullDismissTransform = () => {
  return props.placement === 'right' ? 'translateX(100%)' : 'translateY(100%)'
}

const clearInlineTransform = () => {
  const el = drawerContentRef.value
  if (el) {
    el.style.transform = ''
    el.style.transition = ''
  }
}

const setMaskOpacity = (opacity: number) => {
  if (maskRef.value) {
    maskRef.value.style.opacity = `${Math.max(0, Math.min(1, opacity))}`
  }
}

const clearMaskOpacity = () => {
  if (maskRef.value) {
    maskRef.value.style.opacity = ''
  }
}

// ─── Open / close lifecycle ──────────────────────────────────────────
const open = () => {
  shouldRender.value = true
  phase.value = 'entering'
  lockBodyScroll()

  nextTick(() => {
    requestAnimationFrame(() => {
      phase.value = 'open'
    })
  })
}

const close = () => {
  if (phase.value === 'leaving') return
  phase.value = 'leaving'

  setTimeout(() => {
    finalize()
  }, ANIMATION_DURATION)
}

const swipeDismiss = () => {
  if (phase.value === 'leaving') return
  phase.value = 'leaving'

  const el = drawerContentRef.value
  if (el) {
    const elHeight = el.offsetHeight || 300
    const remaining = Math.max(0, elHeight - currentTranslateY.value)
    const fraction = remaining / elHeight
    const duration = Math.round(Math.max(80, Math.min(280, fraction * 280)))

    el.style.transform = getFullDismissTransform()
    el.style.transition = `transform ${duration}ms ${SPRING_CURVE}`

    if (maskRef.value) {
      maskRef.value.style.transition = `opacity ${duration}ms ease-out`
      maskRef.value.style.opacity = '0'
    }

    setTimeout(() => finalize(), duration)
  } else {
    finalize()
  }
}

const finalize = () => {
  shouldRender.value = false
  phase.value = 'idle'
  clearInlineTransform()
  clearMaskOpacity()
  currentTranslateY.value = 0
  velocity.value = 0
  resetPanels()
  unlockBodyScroll()

  if (visible.value) {
    visible.value = false
  }
}

// ─── Touch handling ──────────────────────────────────────────────────
const onTouchStart = (e: TouchEvent, fromDragHandle = false) => {
  if (phase.value === 'leaving') return

  isDragHandle.value = fromDragHandle

  // For body/panel swipes: only allow when scrolled to top
  if (!fromDragHandle && !isScrollAreaAtTop(e.currentTarget)) return

  const touch = e.touches[0] as Touch | undefined
  if (!touch) return

  touchStartY.value = touch.clientY
  lastTouchY.value = touch.clientY
  lastTouchTime.value = Date.now()
  velocity.value = 0
  isDragging.value = true
}

const onTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return

  const touch = e.touches[0] as Touch | undefined
  if (!touch) return

  const delta = touch.clientY - touchStartY.value

  if (delta < 0 && !isDragHandle.value) {
    isDragging.value = false
    snapBack()
    return
  }

  const now = Date.now()
  const dt = now - lastTouchTime.value
  if (dt > 0) {
    const instantVelocity = ((touch.clientY - lastTouchY.value) / dt) * 1000
    velocity.value = velocity.value * 0.4 + instantVelocity * 0.6
  }
  lastTouchY.value = touch.clientY
  lastTouchTime.value = now

  currentTranslateY.value = Math.max(0, delta)

  if (currentTranslateY.value > 0) {
    e.preventDefault()
  }

  if (drawerContentRef.value) {
    drawerContentRef.value.style.transform = `translateY(${currentTranslateY.value}px)`
    drawerContentRef.value.style.transition = 'none'
  }

  const el = drawerContentRef.value
  if (el) {
    const elHeight = el.offsetHeight || 300
    const progress = Math.min(1, currentTranslateY.value / elHeight)
    setMaskOpacity(1 - progress * 0.8)
  }
}

const onTouchEnd = () => {
  if (!isDragging.value && currentTranslateY.value === 0) return
  isDragging.value = false

  const shouldDismiss = currentTranslateY.value > DISMISS_THRESHOLD || velocity.value > VELOCITY_DISMISS_THRESHOLD

  if (shouldDismiss) {
    swipeDismiss()
  } else {
    snapBack()
  }
}

const snapBack = () => {
  const el = drawerContentRef.value
  if (el) {
    el.style.transform = 'translateY(0)'
    el.style.transition = `transform 300ms ${SPRING_CURVE}`

    const cleanup = () => {
      clearInlineTransform()
      el.removeEventListener('transitionend', cleanup)
    }
    el.addEventListener('transitionend', cleanup, { once: true })
    setTimeout(cleanup, 320)
  }

  clearMaskOpacity()
  currentTranslateY.value = 0
  velocity.value = 0
}

// ─── Mask click & keyboard ───────────────────────────────────────────
const onMaskClick = () => {
  if (props.maskClosable) close()
}

onKeyStroke('Escape', () => {
  if (visible.value && phase.value === 'open') {
    close()
  }
})

// ─── Watch visible prop ──────────────────────────────────────────────
watch(visible, (val) => {
  if (val) {
    open()
  } else if (shouldRender.value && phase.value !== 'leaving') {
    close()
  }
})

if (visible.value) {
  open()
}

onBeforeUnmount(() => {
  unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <!-- Mask -->
    <div
      v-if="shouldRender"
      ref="maskRef"
      class="nc-drawer-mask"
      :class="{
        'nc-drawer-mask-entering': phase === 'entering',
        'nc-drawer-mask-visible': phase === 'open',
        'nc-drawer-mask-leaving': phase === 'leaving',
      }"
      @click="onMaskClick"
    />

    <!-- Content wrapper -->
    <div
      v-if="shouldRender"
      ref="drawerContentRef"
      class="nc-drawer-content-wrapper"
      :class="[
        `nc-drawer-placement-${placement}`,
        wrapClassName,
        {
          'nc-drawer-entering': phase === 'entering',
          'nc-drawer-visible': phase === 'open',
          'nc-drawer-leaving': phase === 'leaving',
        },
      ]"
      :style="{
        height: placement === 'bottom' ? height : '100%',
        maxHeight: placement === 'bottom' ? '85vh' : '100%',
      }"
    >
      <!-- Drag handle (stays fixed at top, doesn't slide with panels) -->
      <div
        v-if="showDragHandle && placement === 'bottom'"
        class="nc-drawer-drag-handle"
        @touchstart="onTouchStart($event, true)"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
      >
        <div class="nc-drawer-drag-indicator" />
      </div>

      <!--
        Horizontal nav slider — holds the main page + any pushed panel pages.
        translateX slides to show the active page.
      -->
      <div class="nc-drawer-nav-slider" :style="navSliderStyle">
        <!-- Page 0: main content (header + body) -->
        <div class="nc-drawer-nav-page">
          <!-- Header (optional) -->
          <div v-if="slots.header || title" class="nc-drawer-header">
            <div class="nc-drawer-header-content">
              <slot name="header">
                <span v-if="title" class="nc-drawer-title">{{ title }}</span>
              </slot>
            </div>
          </div>

          <!-- Main body — swipe-to-dismiss when scrolled to top -->
          <div
            class="nc-drawer-body"
            :class="bodyClassName"
            @touchstart="onTouchStart($event, false)"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <slot />
          </div>
        </div>

        <!-- Panel pages (pushed by NcSubMenu or other children) -->
        <div v-for="(panel, idx) in panelStack" :key="idx" class="nc-drawer-nav-page">
          <!-- Panel header: back arrow left, title centered (Notion-style) -->
          <div class="nc-drawer-panel-header">
            <GeneralIcon icon="arrowLeft" class="nc-drawer-panel-back-icon" @click="popPanel" />
            <div class="nc-drawer-panel-title">
              <component :is="{ render: panel.titleRender }" />
            </div>
          </div>

          <!-- Panel body -->
          <div
            class="nc-drawer-body"
            :class="panelBodyClass"
            @touchstart="onTouchStart($event, false)"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <component :is="{ render: panel.contentRender }" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
// ─── Mask ────────────────────────────────────────────────────────────
.nc-drawer-mask {
  @apply fixed inset-0 bg-black z-1000;
  opacity: 0;
}

.nc-drawer-mask-visible {
  opacity: 0.45;
  transition: opacity 300ms ease-out;

  :global(.dark) & {
    opacity: 0.65;
  }
}

.nc-drawer-mask-leaving {
  opacity: 0;
  transition: opacity 300ms ease-out;
}

// ─── Content wrapper ─────────────────────────────────────────────────
.nc-drawer-content-wrapper {
  @apply fixed z-1001 flex flex-col overflow-hidden;
  will-change: transform;
  background: var(--nc-bg-default);

  :global(.dark) & {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
  }

  &.nc-drawer-placement-bottom {
    @apply bottom-0 left-0 right-0 rounded-t-2xl;
  }

  &.nc-drawer-placement-right {
    @apply top-0 right-0 bottom-0 w-[85vw] max-w-[400px];

    :global(.dark) & {
      border-top: none;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
    }
  }
}

// ─── Phase-driven animations ─────────────────────────────────────────
.nc-drawer-placement-bottom.nc-drawer-entering {
  transform: translateY(100%);
}
.nc-drawer-placement-right.nc-drawer-entering {
  transform: translateX(100%);
}

.nc-drawer-placement-bottom.nc-drawer-visible {
  transform: translateY(0);
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
.nc-drawer-placement-right.nc-drawer-visible {
  transform: translateX(0);
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.nc-drawer-placement-bottom.nc-drawer-leaving {
  transform: translateY(100%);
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
.nc-drawer-placement-right.nc-drawer-leaving {
  transform: translateX(100%);
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

// ─── Nav slider ──────────────────────────────────────────────────────
.nc-drawer-nav-slider {
  @apply flex flex-1 min-h-0;
}

.nc-drawer-nav-page {
  @apply flex flex-col flex-shrink-0 min-h-0;
  width: 100%;
}

// ─── Internal elements ───────────────────────────────────────────────
.nc-drawer-drag-handle {
  @apply flex-none h-7 flex items-center justify-center;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.nc-drawer-drag-indicator {
  @apply w-9 h-1 rounded-full bg-nc-bg-gray-dark;
}

.nc-drawer-header {
  @apply flex items-center justify-center px-4 py-2 flex-none;
}

.nc-drawer-header-content {
  @apply flex items-center justify-center min-w-0;
}

.nc-drawer-title {
  @apply text-sm font-semibold text-nc-content-gray truncate;
}

.nc-drawer-body {
  @apply flex-1 overflow-auto overscroll-contain;
}

// ─── Panel header (Notion-style: back arrow left, title centered) ───
.nc-drawer-panel-header {
  @apply flex items-center px-4 py-3 flex-none relative;
}

.nc-drawer-panel-back-icon {
  @apply text-nc-content-gray-subtle text-lg flex-none z-1;
  cursor: pointer;
}

.nc-drawer-panel-title {
  @apply absolute inset-0 flex items-center justify-center text-sm font-semibold text-nc-content-gray pointer-events-none;
}
</style>
