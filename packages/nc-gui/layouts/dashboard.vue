<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const { isOpen } = storeToRefs(useSidebarStore())
const wrapperRef = ref<HTMLDivElement>()
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
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
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
  <NuxtLayout>
    <Splitpanes
      style="height: 100vh"
      :class="{
        'sidebar-short': isSidebarShort,
      }"
      @resize="currentSidebarSize = $event[0].size"
    >
      <Pane min-size="15%" :size="currentSidebarSize" max-size="40%" class="nc-sidebar-splitpane relative !overflow-visible">
        <div
          ref="wrapperRef"
          class="nc-sidebar-wrapper relative z-10"
          :class="{
            'open': isOpen,
            'close': !isOpen,
            'absolute': isMouseOverShowSidebarZone,
            'sidebar-short': isSidebarShort,
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
      <div v-if="!isOpen" class="absolute top-0 left-0 pl-2 flex flex-col h-full z-40">
        <div class="mt-2 p-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer" @click="isOpen = true">
          <MdiMenu v-if="isSidebarHidden && !isStartHideSidebarAnimation" />
          <IcBaselineKeyboardDoubleArrowRight v-else />
        </div>
      </div>
      <Pane :size="contentSize.current">
        <slot name="content" />
      </Pane>
    </Splitpanes>
  </NuxtLayout>
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

.sidebar-short {
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

.nc-sidebar-wrapper {
  @apply flex flex-col h-full justify-center;
}

.nc-sidebar-wrapper.close {
  > * {
    height: 80vh;
  }
}

.nc-sidebar-wrapper.sidebar-short {
  > * {
    height: 80vh !important;
  }
}

.nc-sidebar-wrapper.open {
  height: 100vh;
  > * {
    height: 100vh;
  }
}

.nc-sidebar-wrapper > * {
  height: calc(100% - var(--header-height));
}

.nc-sidebar-wrapper > * {
  width: 100%;
  transition: all 0.3s ease-in-out;
}

.nc-sidebar-wrapper.hide-sidebar > * {
  position: absolute;
  transform: translateX(-100%);
  opacity: 0;
}
.nc-sidebar-wrapper.sidebar-short > * {
  @apply !(rounded-lg border-1 border-gray-100 shadow-lg);
}
</style>
