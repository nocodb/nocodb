<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const router = useRouter()
const route = router.currentRoute

const { setLeftSidebarSize } = useGlobal()

const configStore = useConfigStore()

const { isMobileMode } = storeToRefs(configStore)

const slots = useSlots()

const {
  isLeftSidebarOpen,
  leftSidebarWidthPercent,
  leftSideBarSize: sideBarSize,
  leftSidebarState: sidebarState,
  mobileNormalizedSidebarSize,
  hideMiniSidebar,
  hideSidebar,
  showTopbar,
  miniSidebarWidth,
  isFullScreen,
} = storeToRefs(useSidebarStore())

const { isSharedBase } = storeToRefs(useBase())

const workspaceId = computed(() => {
  return route.value.params.typeOrId as string
})

const wrapperRef = ref<HTMLDivElement>()

const animationDuration = 250

const viewportWidth = ref(window.innerWidth)

const { isPanelExpanded: isChatPanelExpanded, isFullScreen: isChatFullScreen } = useChatPanel()

const { isRtl } = useRtl()

const isChatToggling = ref(false)

const currentSidebarSize = computed({
  get: () => sideBarSize.value.current,
  set: (val) => {
    sideBarSize.value.current = val
    sideBarSize.value.old = val
  },
})

const mobileNormalizedContentSize = computed(() => {
  if (isMobileMode.value) {
    return isLeftSidebarOpen.value ? 0 : 100
  }

  return 100 - leftSidebarWidthPercent.value
})

const isMiniSidebarVisible = computed(() => {
  return (
    !hideMiniSidebar.value &&
    slots.sidebar &&
    !isSharedBase.value &&
    (!isMobileMode.value || isLeftSidebarOpen.value) &&
    !isFullScreen.value &&
    !isWsHomeRoute(route.value)
  )
})

watch(currentSidebarSize, () => {
  leftSidebarWidthPercent.value = (currentSidebarSize.value / viewportWidth.value) * 100
  setLeftSidebarSize({ current: currentSidebarSize.value, old: sideBarSize.value.old })
})

const sidebarWidth = computed(() => (isMobileMode.value ? viewportWidth.value : sideBarSize.value.old))

const remToPx = (rem: number) => {
  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return rem * fontSize
}

const normalizedMiniSidebarWidth = computed(() => {
  return isMiniSidebarVisible.value ? miniSidebarWidth.value : 0
})

const normalizedWidth = computed(() => {
  const maxSize = remToPx(viewportWidth.value <= 1560 ? 20 : 35)
  const minSize = remToPx(16)

  if (sidebarWidth.value > maxSize) {
    return maxSize - miniSidebarWidth.value
  } else if (sidebarWidth.value < minSize) {
    return minSize - miniSidebarWidth.value
  } else {
    return sidebarWidth.value - (sidebarState.value === 'openEnd' ? miniSidebarWidth.value : 0)
  }
})

watch(
  isLeftSidebarOpen,
  () => {
    sideBarSize.value.current = sideBarSize.value.old

    if (isLeftSidebarOpen.value) {
      setTimeout(() => (sidebarState.value = 'openStart'), 0)

      setTimeout(() => (sidebarState.value = 'openEnd'), animationDuration)
    } else {
      sideBarSize.value.old = sideBarSize.value.current
      sideBarSize.value.current = 0

      sidebarState.value = 'hiddenStart'

      setTimeout(() => {
        sidebarState.value = 'hiddenEnd'
      }, animationDuration)
    }
  },
  {
    immediate: true,
  },
)

function handleMouseMove(e: MouseEvent) {
  if (isMobileMode.value) return
  if (!wrapperRef.value) return
  if (isFullScreen.value) return
  if (sidebarState.value === 'openEnd') return

  const isNearSidebarEdge = isRtl.value
    ? e.clientX > window.innerWidth - 4 - normalizedMiniSidebarWidth.value
    : e.clientX < 4 + normalizedMiniSidebarWidth.value

  const isAwayFromSidebar = isRtl.value
    ? e.clientX < window.innerWidth - sidebarWidth.value - 10 - normalizedMiniSidebarWidth.value
    : e.clientX > sidebarWidth.value + 10 + normalizedMiniSidebarWidth.value

  if (isNearSidebarEdge && ['hiddenEnd', 'peekCloseEnd'].includes(sidebarState.value)) {
    sidebarState.value = 'peekOpenStart'

    setTimeout(() => {
      sidebarState.value = 'peekOpenEnd'
    }, animationDuration)
  } else if (isAwayFromSidebar && sidebarState.value === 'peekOpenEnd') {
    if ((e.target as HTMLElement).closest('.nc-dropdown.active') || isNcDropdownOpen()) {
      return
    }

    sidebarState.value = 'peekCloseOpen'

    setTimeout(() => {
      sidebarState.value = 'peekCloseEnd'
    }, animationDuration)
  }
}

function onWindowResize(e?: any): void {
  if (isChatToggling.value) return

  const chatPanelOffset = parseFloat(document.documentElement.style.getPropertyValue('--nc-chat-panel-offset')) || 0
  viewportWidth.value = window.innerWidth - chatPanelOffset

  if (!e && isLeftSidebarOpen.value && !sideBarSize.value.current && !isMobileMode.value) {
    currentSidebarSize.value = sideBarSize.value.old
  }

  leftSidebarWidthPercent.value = (currentSidebarSize.value / viewportWidth.value) * 100

  if (e && normalizedWidth.value < sidebarWidth.value) {
    onResize(leftSidebarWidthPercent.value)
  }
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

watch(isMobileMode, () => {
  isLeftSidebarOpen.value = !isMobileMode.value
})

watch(sidebarState, () => {
  if (sidebarState.value === 'peekCloseEnd') {
    setTimeout(() => {
      sidebarState.value = 'hiddenEnd'
    }, animationDuration)
  }
})

function onResize(widthPercent: any) {
  if (isMobileMode.value) return

  const width = (widthPercent * viewportWidth.value) / 100

  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)

  if (viewportWidth.value <= 1560) {
    if (width > remToPx(20)) {
      sideBarSize.value.old = 20 * fontSize
      if (isLeftSidebarOpen.value) sideBarSize.value.current = sideBarSize.value.old
      return
    }
  }

  const widthRem = width / fontSize

  if (widthRem < 16) {
    sideBarSize.value.old = 16 * fontSize
    if (isLeftSidebarOpen.value) sideBarSize.value.current = sideBarSize.value.old
    return
  } else if (widthRem > 35) {
    sideBarSize.value.old = 35 * fontSize
    if (isLeftSidebarOpen.value) sideBarSize.value.current = sideBarSize.value.old

    return
  }

  sideBarSize.value.old = width
  sideBarSize.value.current = sideBarSize.value.old
}

const contentWidthStyle = computed(() => ({
  width: isMiniSidebarVisible.value
    ? 'calc(100vw - var(--mini-sidebar-width) - var(--nc-chat-panel-offset, 0px))'
    : 'calc(100vw - var(--nc-chat-panel-offset, 0px))',
}))

watch(isChatPanelExpanded, () => {
  isChatToggling.value = true
  document.documentElement.classList.add('nc-chat-toggling')

  nextTick(() => {
    const offset = parseFloat(document.documentElement.style.getPropertyValue('--nc-chat-panel-offset')) || 0
    viewportWidth.value = window.innerWidth - offset

    const containerWidth = isMiniSidebarVisible.value ? viewportWidth.value - miniSidebarWidth.value : viewportWidth.value
    if (containerWidth > 0) {
      leftSidebarWidthPercent.value = (currentSidebarSize.value / containerWidth) * 100
    }

    window.dispatchEvent(new Event('resize'))
    setTimeout(() => {
      isChatToggling.value = false
      document.documentElement.classList.remove('nc-chat-toggling')
    }, 50)
  })
})
</script>

<template>
  <div class="h-full flex items-stretch">
    <DashboardMiniSidebarV2 v-if="isMiniSidebarVisible" />

    <div
      class="flex-none overflow-hidden nc-view-content-area"
      :class="{ 'nc-view-content-hidden': isChatFullScreen }"
      :style="contentWidthStyle"
    >
      <DashboardTopbar v-if="showTopbar" :workspace-id="workspaceId" />
      <Splitpanes
        class="nc-sidebar-content-resizable-wrapper h-full"
        :class="{
          'sidebar-closed': !isLeftSidebarOpen,
          'hide-resize-bar': !isLeftSidebarOpen || sidebarState === 'openStart' || hideSidebar,
        }"
        :rtl="isRtl"
        @ready="() => onWindowResize()"
        @resize="(event: any) => onResize(event[0].size)"
      >
        <Pane
          min-size="15%"
          :size="mobileNormalizedSidebarSize"
          max-size="60%"
          class="nc-sidebar-splitpane !sm:max-w-140 relative !overflow-visible flex"
          :class="{
            hidden: hideSidebar,
          }"
          :style="{
            'width': `${mobileNormalizedSidebarSize}%`,
            'min-width': `${mobileNormalizedSidebarSize}%`,
          }"
        >
          <div
            ref="wrapperRef"
            class="nc-sidebar-wrapper relative nc-new-sidebar flex flex-col h-full justify-center !sm:(max-w-140) absolute overflow-visible"
            :class="{
              'mobile': isMobileMode,
              'minimized-height': !isLeftSidebarOpen,
              'hide-sidebar': ['hiddenStart', 'hiddenEnd', 'peekCloseEnd'].includes(sidebarState),
            }"
            :style="{
              width: sidebarState === 'hiddenEnd' ? '0px' : `${sidebarWidth}px`,
              minWidth: sidebarState === 'hiddenEnd' ? '0px' : `${normalizedWidth}px`,
            }"
          >
            <slot name="sidebar" />
          </div>
        </Pane>
        <Pane
          :size="mobileNormalizedContentSize"
          class="flex-grow !overflow-auto"
          :style="{
            'min-width': `${mobileNormalizedContentSize}%`,
          }"
        >
          <slot name="content" />
        </Pane>
      </Splitpanes>
    </div>
  </div>
</template>

<style lang="scss">
.nc-sidebar-wrapper.minimized-height {
  & > * {
    @apply h-4/5 pb-2 !(rounded-r-lg border-1 border-nc-border-gray-medium shadow-lg);
    width: calc(100% + 4px);
  }

  &.nc-new-sidebar > * {
    @apply !border-l-0;
  }
}

.mobile.nc-sidebar-wrapper.minimized-height > * {
  @apply !h-full;
}

.nc-sidebar-wrapper > * {
  transition: all 0.2s ease-in-out;
  @apply z-501 absolute;
}

.nc-sidebar-wrapper.hide-sidebar {
  @apply !min-w-0;

  > * {
    @apply opacity-0;
    z-index: -1 !important;
    transform: translateX(-100%);
  }
}

/** Split pane CSS */

.nc-sidebar-content-resizable-wrapper {
  > .splitpanes__splitter {
    @apply !w-0 relative overflow-visible;
  }

  > .splitpanes__splitter:before {
    @apply bg-nc-bg-gray-medium w-0.25 absolute left-0 top-0 h-full z-40;
    content: '';
  }

  > .splitpanes__splitter:hover:before {
    @apply bg-nc-border-gray-medium;
    width: 3px !important;
    left: 0px;
  }

  &.splitpanes--dragging > .splitpanes__splitter:before {
    @apply bg-nc-border-gray-medium;
    width: 3px !important;
    left: 0px;
  }

  &.splitpanes--dragging > .splitpanes__splitter {
    @apply w-1 mr-0;
  }

  &.sidebar-closed > .splitpanes__splitter {
    display: none !important;

    &:before {
      display: none !important;
    }
  }
}

.nc-sidebar-content-resizable-wrapper.hide-resize-bar {
  > .splitpanes__splitter {
    cursor: default !important;
    opacity: 0 !important;
    background-color: transparent !important;
  }
}

.splitpanes__pane {
  transition: width 0.15s ease-in-out !important;
}

.splitpanes--dragging {
  cursor: col-resize;

  > .splitpanes__pane {
    transition: none !important;
  }
}

:root.nc-chat-toggling .splitpanes__pane {
  transition: none !important;
}

.nc-view-content-area {
  transition: opacity 200ms ease;
}

.nc-view-content-hidden {
  opacity: 0;
  pointer-events: none;
}

/** RTL overrides */
.rtl {
  .nc-sidebar-wrapper.minimized-height {
    & > * {
      @apply !rounded-r-none !rounded-l-lg;
    }

    &.nc-new-sidebar > * {
      @apply !border-l-1 !border-r-0;
    }
  }

  .nc-sidebar-wrapper.hide-sidebar {
    > * {
      transform: translateX(100%);
    }
  }

  .nc-sidebar-content-resizable-wrapper {
    > .splitpanes__splitter:before {
      @apply left-auto right-0;
    }

    > .splitpanes__splitter:hover:before {
      left: auto;
      right: 0px;
    }

    &.splitpanes--dragging > .splitpanes__splitter:before {
      left: auto;
      right: 0px;
    }

    &.splitpanes--dragging > .splitpanes__splitter {
      @apply mr-auto ml-0;
    }
  }
}
</style>
