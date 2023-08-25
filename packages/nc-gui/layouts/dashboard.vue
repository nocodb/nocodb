<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const router = useRouter()
const route = router.currentRoute

const { isLeftSidebarOpen, leftSidebarWidthPercent } = storeToRefs(useSidebarStore())
const wrapperRef = ref<HTMLDivElement>()
const sideBarSize = ref({
  old: 17.5,
  current: 17.5,
})
const contentSize = ref({
  old: 82.5,
  current: 82.5,
})
const isSidebarShort = ref(false)
const animationDuration = 175
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

watch(
  currentSidebarSize,
  () => {
    leftSidebarWidthPercent.value = currentSidebarSize.value
  },
  {
    immediate: true,
  },
)

const isSidebarHidden = ref(false)

watch(isLeftSidebarOpen, () => {
  sideBarSize.value.current = sideBarSize.value.old

  if (isLeftSidebarOpen.value) {
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
  if (isLeftSidebarOpen.value && !isSidebarHidden.value && !isMouseOverShowSidebarZone.value) return
  if (isLeftSidebarOpen.value) {
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
  () => !isLeftSidebarOpen.value && isSidebarShort.value,
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

watch(route, () => {
  if (route.value.name === 'index-index') {
    isLeftSidebarOpen.value = true
  }
})
</script>

<script lang="ts">
export default {
  name: 'DashboardLayout',
}
</script>

<template>
  <NuxtLayout>
    <slot v-if="!route.meta.hasSidebar" name="content" />
    <Splitpanes
      v-else
      style="height: 100vh"
      class="nc-sidebar-content-resizable-wrapper w-full"
      :class="{
        'sidebar-short': isSidebarShort,
      }"
      @resize="currentSidebarSize = $event[0].size"
    >
      <Pane min-size="15%" :size="currentSidebarSize" max-size="40%" class="nc-sidebar-splitpane relative !overflow-visible">
        <div
          ref="wrapperRef"
          class="nc-sidebar-wrapper relative"
          :class="{
            'open': isLeftSidebarOpen,
            'close': !isLeftSidebarOpen,
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
      <Pane :size="contentSize.current">
        <slot name="content" />
      </Pane>
    </Splitpanes>
  </NuxtLayout>
</template>

<style lang="scss">
.nc-sidebar-content-resizable-wrapper > {
  .splitpanes__splitter {
    width: 0 !important;
    position: relative;
    overflow: visible;
  }
  .splitpanes__splitter:before {
    @apply bg-gray-200 w-0.25;
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
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

  .splitpanes--dragging .splitpanes__splitter {
    @apply w-1 mr-0;
  }

  .sidebar-short > .splitpanes__splitter {
    display: none !important;
    background-color: transparent !important;
  }
}

.splitpanes--dragging {
  cursor: col-resize;
}

.nc-sidebar-wrapper {
  @apply flex flex-col h-full justify-center !min-w-32;
}

.nc-sidebar-wrapper.close {
  > * {
    height: 80vh;
  }
}

.nc-sidebar-wrapper.sidebar-short {
  > * {
    @apply z-10;
    height: 80vh !important;
    padding-bottom: 0.35rem;
  }
}

.nc-sidebar-wrapper.open {
  height: 100vh;
  > * {
    height: 100vh;
  }
}

.nc-sidebar-wrapper > * {
  height: calc(100% - var(--sidebar-top-height));
}

.nc-sidebar-wrapper > * {
  width: 100%;
  transition: all 0.2s ease-in-out;
}

.nc-sidebar-wrapper.hide-sidebar {
  min-width: 0 !important;
}

.nc-sidebar-wrapper.hide-sidebar > * {
  position: absolute;
  transform: translateX(-100%);
  opacity: 0;
}
.nc-sidebar-wrapper.sidebar-short > * {
  @apply !(rounded-r-lg border-1 border-gray-200 shadow-lg);
}
</style>
