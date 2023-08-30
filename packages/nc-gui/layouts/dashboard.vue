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
const contentSize = computed(() => 100 - sideBarSize.value.current)
const animationDuration = 250
const viewportWidth = ref(window.innerWidth)

const leftSidebarState = ref<
  'openStart' | 'openEnd' | 'hiddenStart' | 'hiddenEnd' | 'peekOpenStart' | 'peekOpenEnd' | 'peekCloseOpen' | 'peekCloseEnd'
>('openEnd')

const sidebarWidth = computed(() => (sideBarSize.value.old * viewportWidth.value) / 100)
const currentSidebarSize = computed({
  get: () => sideBarSize.value.current,
  set: (val) => {
    sideBarSize.value.current = val
    sideBarSize.value.old = val
  },
})

watch(currentSidebarSize, () => {
  leftSidebarWidthPercent.value = currentSidebarSize.value
})

watch(isLeftSidebarOpen, () => {
  sideBarSize.value.current = sideBarSize.value.old

  if (isLeftSidebarOpen.value) {
    setTimeout(() => (leftSidebarState.value = 'openStart'), 0)

    setTimeout(() => (leftSidebarState.value = 'openEnd'), animationDuration / 2)
  } else {
    sideBarSize.value.old = sideBarSize.value.current

    leftSidebarState.value = 'hiddenStart'

    setTimeout(() => {
      sideBarSize.value.current = 0

      leftSidebarState.value = 'hiddenEnd'
    }, animationDuration)
  }
})

function handleMouseMove(e: MouseEvent) {
  if (!wrapperRef.value) return
  if (leftSidebarState.value === 'openEnd') return

  if (e.clientX < 4 && ['hiddenEnd', 'peekCloseEnd'].includes(leftSidebarState.value)) {
    leftSidebarState.value = 'peekOpenStart'

    setTimeout(() => {
      leftSidebarState.value = 'peekOpenEnd'
    }, animationDuration)
  } else if (e.clientX > sidebarWidth.value + 10 && leftSidebarState.value === 'peekOpenEnd') {
    leftSidebarState.value = 'peekCloseOpen'

    setTimeout(() => {
      leftSidebarState.value = 'peekCloseEnd'
    }, animationDuration)
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
  <NuxtLayout class="h-screen">
    <slot v-if="!route.meta.hasSidebar" name="content" />
    <Splitpanes
      v-else
      class="nc-sidebar-content-resizable-wrapper w-full h-full"
      :class="{
        'hide-resize-bar': !isLeftSidebarOpen || leftSidebarState === 'openStart',
      }"
      @resize="currentSidebarSize = $event[0].size"
    >
      <Pane min-size="15%" :size="currentSidebarSize" max-size="40%" class="nc-sidebar-splitpane relative !overflow-visible">
        <div
          ref="wrapperRef"
          class="nc-sidebar-wrapper relative flex flex-col h-full justify-center !min-w-32 absolute overflow-visible"
          :class="{
            'minimized-height': !isLeftSidebarOpen,
            'sidebar-show-animating': leftSidebarState === 'openEnd',
            'hide-sidebar': ['hiddenStart', 'hiddenEnd', 'peekCloseEnd'].includes(leftSidebarState),
          }"
          :style="{
            width: leftSidebarState === 'hiddenEnd' ? '0px' : `${sidebarWidth}px`,
          }"
        >
          <slot name="sidebar" />
        </div>
      </Pane>
      <Pane :size="contentSize">
        <slot name="content" />
      </Pane>
    </Splitpanes>
  </NuxtLayout>
</template>

<style lang="scss">
.nc-sidebar-wrapper.minimized-height > * {
  @apply h-4/5 pb-2 !(rounded-r-lg border-1 border-gray-200 shadow-lg);
}

.nc-sidebar-wrapper > * {
  transition: all 0.2s ease-in-out;
  @apply z-10 absolute;
}

.nc-sidebar-wrapper.hide-sidebar {
  @apply !min-w-0;

  > * {
    @apply opacity-0;
    transform: translateX(-100%);
  }
}

.nc-sidebar-wrapper.sidebar-show-animating {
  > * {
    transition: all 0.2s ease-in-out;
  }
}

/** Split pane CSS */

.nc-sidebar-content-resizable-wrapper > {
  .splitpanes__splitter {
    @apply !w-0 relative overflow-visible;
  }
  .splitpanes__splitter:before {
    @apply bg-gray-200 w-0.25 absolute left-0 top-0 h-full z-40;
    content: '';
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
}

.nc-sidebar-content-resizable-wrapper.hide-resize-bar > {
  .splitpanes__splitter {
    display: none !important;
    background-color: transparent !important;
  }
}

.splitpanes__pane {
  transition: width 0.1s ease-in-out !important;
}

.splitpanes--dragging {
  cursor: col-resize;

  > .splitpanes__pane {
    transition: none !important;
  }
}
</style>
