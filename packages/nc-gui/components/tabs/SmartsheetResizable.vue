<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const {
  isRightSidebarOpen,
  isLeftSidebarOpen,
  leftSidebarWidthPercent,
  rightSidebarSize: sideBarSize,
} = storeToRefs(useSidebarStore())
const wrapperRef = ref<HTMLDivElement>()
const splitpaneWrapperRef = ref()

const { rightSidebarState: sidebarState } = storeToRefs(useSidebarStore())

const contentSize = computed(() => 100 - sideBarSize.value.current)
const animationDuration = 250
const contentDomWidth = ref(window.innerWidth)

const sidebarWidth = computed(() => (sideBarSize.value.old * contentDomWidth.value) / 100)
const currentSidebarSize = computed({
  get: () => sideBarSize.value.current,
  set: (val) => {
    sideBarSize.value.current = val
    sideBarSize.value.old = val
  },
})

watch(isRightSidebarOpen, () => {
  sideBarSize.value.current = sideBarSize.value.old

  if (isRightSidebarOpen.value) {
    setTimeout(() => (sidebarState.value = 'openStart'), 0)

    setTimeout(() => (sidebarState.value = 'openEnd'), animationDuration)
  } else {
    sideBarSize.value.old = sideBarSize.value.current

    sidebarState.value = 'hiddenStart'

    setTimeout(() => {
      sideBarSize.value.current = 0

      sidebarState.value = 'hiddenEnd'
    }, animationDuration)
  }
})

function handleMouseMove(e: MouseEvent) {
  if (!wrapperRef.value) return
  if (sidebarState.value === 'openEnd') return

  const viewportWidth = window.innerWidth

  if (e.clientX > viewportWidth - 14 && ['hiddenEnd', 'peekCloseEnd'].includes(sidebarState.value)) {
    sidebarState.value = 'peekOpenStart'

    setTimeout(() => {
      sidebarState.value = 'peekOpenEnd'
    }, animationDuration)
  } else if (e.clientX < viewportWidth - (sidebarWidth.value + 10) && sidebarState.value === 'peekOpenEnd') {
    sidebarState.value = 'peekCloseOpen'

    setTimeout(() => {
      sidebarState.value = 'peekCloseEnd'
    }, animationDuration)
  }
}

function onWindowResize() {
  contentDomWidth.value = ((100 - leftSidebarWidthPercent.value) / 100) * window.innerWidth
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
  [isLeftSidebarOpen, leftSidebarWidthPercent],
  () => {
    if (isLeftSidebarOpen.value) {
      contentDomWidth.value = ((100 - leftSidebarWidthPercent.value) / 100) * window.innerWidth
    } else {
      contentDomWidth.value = window.innerWidth
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <Splitpanes
    ref="splitpaneWrapperRef"
    class="nc-view-sidebar-content-resizable-wrapper w-full h-full"
    :class="{
      'hide-resize-bar': !isRightSidebarOpen || sidebarState === 'openStart',
    }"
    @resize="currentSidebarSize = $event[1].size"
  >
    <Pane :size="contentSize">
      <slot name="content" />
    </Pane>
    <Pane min-size="15%" :size="currentSidebarSize" max-size="40%" class="nc-view-sidebar-splitpane relative !overflow-visible">
      <div
        ref="wrapperRef"
        class="nc-view-sidebar-wrapper relative flex flex-col h-full justify-center !min-w-32 absolute overflow-visible"
        :class="{
          'minimized-height': !isRightSidebarOpen,
          'peek-sidebar': ['peekOpenEnd', 'peekCloseOpen'].includes(sidebarState),
          'hide-sidebar': ['hiddenStart', 'hiddenEnd', 'peekCloseEnd'].includes(sidebarState),
        }"
        :style="{
          width: sidebarState === 'hiddenEnd' ? '0px' : `${sidebarWidth}px`,
        }"
      >
        <slot name="sidebar" />
      </div>
    </Pane>
  </Splitpanes>
</template>

<style lang="scss">
.nc-view-sidebar-wrapper.minimized-height > * {
  @apply pb-1 !(rounded-l-lg border-1 border-gray-200 shadow-lg);
  height: 89.5%;
}

.nc-view-sidebar-wrapper > * {
  transition: all 0.15s ease-in-out;
  @apply z-10 absolute;
}

.nc-view-sidebar-wrapper.peek-sidebar {
  > * {
    @apply !opacity-100;
    transform: translateX(-100%);
  }
}

.nc-view-sidebar-wrapper.hide-sidebar {
  @apply !min-w-0;

  > * {
    @apply opacity-0;
    transform: translateX(100%);
  }
}

/** Split pane CSS */

.nc-view-sidebar-content-resizable-wrapper > {
  .splitpanes__splitter {
    width: 0 !important;
    position: relative;
    overflow: visible;
  }
  .splitpanes__splitter:before {
    @apply bg-transparent;
    width: 1px;
    content: '';
    position: absolute;
    left: -2px;
    top: 0;
    height: 100%;
    z-index: 40;
  }

  .splitpanes__splitter:hover:before {
    @apply bg-scrollbar;
    z-index: 40;
    width: 4px !important;
    left: -2px;
  }

  .splitpanes--dragging .splitpanes__splitter:before {
    @apply bg-scrollbar;
    z-index: 40;
    width: 10px !important;
    left: -2px;
  }
}

.splitpanes--dragging > .splitpanes__splitter::before {
  @apply w-1 mr-0 bg-scrollbar;
  z-index: 40;
  width: 4px !important;
  left: -2px;
}

.splitpanes--dragging {
  cursor: col-resize;
}

.nc-view-sidebar-content-resizable-wrapper.hide-resize-bar > {
  .splitpanes__splitter {
    display: none !important;
    background-color: transparent !important;
  }
}
</style>
