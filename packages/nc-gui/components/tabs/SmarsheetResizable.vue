<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const { isOpen } = storeToRefs(useSidebarStore())
const wrapperRef = ref<HTMLDivElement>()
const splitpaneWrapperRef = ref()
const sideBarSize = ref({
  old: 20,
  current: 20,
})
const contentSize = ref({
  old: 80,
  current: 80,
})
const isSidebarShort = ref(false)
const animationDuration = 300
const viewportWidth = ref(window.innerWidth)
const isMouseOverShowSidebarZone = ref(false)
const isAnimationEndAfterSidebarHide = ref(false)
const isStartHideSidebarAnimation = ref(false)

const sidebarWidth = computed(() => (sideBarSize.value.old * viewportWidth.value) / 100)
const currentSidebarSize = computed({
  get: () => sideBarSize.value.current,
  set: (val) => {
    sideBarSize.value.current = val
    sideBarSize.value.old = val
  },
})

const isSidebarHidden = ref(false)

watch(isOpen, () => {
  sideBarSize.value.current = sideBarSize.value.old

  if (isOpen.value) {
    contentSize.value.current = contentSize.value.old

    setTimeout(() => {
      isSidebarShort.value = true

      isSidebarHidden.value = false
    }, 0)

    setTimeout(() => {
      isSidebarShort.value = false
    }, animationDuration / 2)
  } else {
    sideBarSize.value.old = sideBarSize.value.current

    contentSize.value.current = contentSize.value.old
    contentSize.value.current = 100

    isSidebarShort.value = true
    isAnimationEndAfterSidebarHide.value = false

    setTimeout(() => {
      isSidebarHidden.value = true
      sideBarSize.value.current = 0
      isAnimationEndAfterSidebarHide.value = true
    }, animationDuration * 1.75)
  }
})

function handleMouseMove(e: MouseEvent) {
  if (!wrapperRef.value) return
  if (isOpen.value && !isSidebarHidden.value && !isMouseOverShowSidebarZone.value) return
  if (isOpen.value) {
    isSidebarHidden.value = false
    isMouseOverShowSidebarZone.value = false
    return
  }

  if (e.clientX < 4) {
    isSidebarHidden.value = false
    isMouseOverShowSidebarZone.value = true
  } else if (e.clientX > sidebarWidth.value + 10 && !isSidebarHidden.value) {
    isSidebarHidden.value = true
    isMouseOverShowSidebarZone.value = false
    isAnimationEndAfterSidebarHide.value = false

    setTimeout(() => {
      isAnimationEndAfterSidebarHide.value = true
    }, animationDuration * 1.75)
  }
}

function onWindowResize() {
  viewportWidth.value = splitpaneWrapperRef.value?.$el?.clientWidth
}

onMounted(() => {
  viewportWidth.value = splitpaneWrapperRef.value?.$el?.clientWidth
  document.addEventListener('mousemove', handleMouseMove)

  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('resize', onWindowResize)
})

watch(
  () => !isOpen.value && isSidebarShort.value,
  (value) => {
    if (value) {
      setTimeout(() => {
        isStartHideSidebarAnimation.value = true
      }, animationDuration / 2)
    } else {
      isStartHideSidebarAnimation.value = false
    }
  },
)
</script>

<script lang="ts">
export default {
  name: 'DashboardLayout',
}
</script>

<template>
  <Splitpanes
    ref="splitpaneWrapperRef"
    style="height: 100vh"
    :class="{
      'smartsheet-sidebar-short': isSidebarShort,
    }"
    @resize="currentSidebarSize = $event[1].size"
  >
    <Pane :size="contentSize.current">
      <slot name="content" />
    </Pane>
    <Pane
      min-size="15%"
      :size="currentSidebarSize"
      max-size="40%"
      class="nc-smartsheet-sidebar-splitpane relative !overflow-visible"
    >
      <div
        ref="wrapperRef"
        class="nc-smartsheet-sidebar-wrapper relative z-10"
        :class="{
          'open': isOpen,
          'close': !isOpen,
          'absolute': isMouseOverShowSidebarZone,
          'smartsheet-sidebar-short': isSidebarShort,
          'hide-sidebar': isStartHideSidebarAnimation && !isMouseOverShowSidebarZone,
        }"
        :style="{
          width: isAnimationEndAfterSidebarHide && isSidebarHidden ? '0px' : `${sidebarWidth}px`,
          overflow: isMouseOverShowSidebarZone ? 'visible' : undefined,
        }"
      >
        <slot name="sidebar" />
      </div>
    </Pane>
  </Splitpanes>
</template>

<style lang="scss">
.splitpanes__splitter {
  width: 0 !important;
  position: relative;
  overflow: visible;
}
.splitpanes__splitter:before {
  @apply bg-border w-0.25;
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100vh;
  z-index: 40;
}

.splitpanes__splitter:hover:before {
  @apply bg-scrollbar;
  width: 3px !important;
  left: -3px;
}

.splitpanes--dragging .splitpanes__splitter:before {
  @apply bg-scrollbar;
  width: 3px !important;
  left: -3px;
}

.smartsheet-sidebar-short {
  .splitpanes__splitter {
    display: none !important;
    background-color: transparent !important;
  }
}
.splitpanes--dragging .splitpanes__splitter {
  @apply w-1 mr-0;
}

.splitpanes--dragging {
  cursor: ew-resize;
}

.nc-smartsheet-sidebar-wrapper {
  @apply flex flex-col h-full justify-center;
}

.nc-smartsheet-sidebar-wrapper.close {
  > * {
    height: 70vh;
  }
}

.nc-smartsheet-sidebar-wrapper.smartsheet-sidebar-short {
  > * {
    height: 70vh !important;
    padding-bottom: 0.35rem;
  }
}

.nc-smartsheet-sidebar-wrapper.open {
  height: calc(100vh - var(--topbar-height));
  > * {
    height: calc(100vh - var(--topbar-height));
  }
}

.nc-smartsheet-sidebar-wrapper > * {
  height: calc(100% - var(--topbar-height));
}

.nc-smartsheet-sidebar-wrapper > * {
  width: 100%;
  transition: all 0.3s ease-in-out;
}

.nc-smartsheet-sidebar-wrapper.hide-sidebar > * {
  position: absolute;
  transform: translateX(+100%);
  opacity: 0;
}
.nc-smartsheet-sidebar-wrapper.smartsheet-sidebar-short > * {
  @apply !(rounded-r-lg border-1 border-gray-100 shadow-lg);
}
</style>
