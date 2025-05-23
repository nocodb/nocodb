<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const route = useRoute()

const { isMobileMode } = useGlobal()

const {
  leftSidebarWidth,
  windowSize,
  expandedFormRightSidebarState,
  expandedFormRightSidebarWidthPercent,
  isExpandedFormSidebarEnabled,
  normalizeExpandedFormSidebarWidth,
  miniSidebarWidth,
} = storeToRefs(useSidebarStore())

const isReadySidebar = ref(false)

const expandedFormPreviewSize = computed(() => {
  if (isMobileMode.value || !route.query.rowId) return 100

  return 100 - expandedFormRightSidebarWidthPercent.value
})

function onResize(widthPercent: any) {
  const sidebarWidth = (widthPercent * (windowSize.value - leftSidebarWidth.value - miniSidebarWidth.value)) / 100

  if (sidebarWidth > expandedFormRightSidebarState.value.maxWidth) {
    expandedFormRightSidebarState.value.width = expandedFormRightSidebarState.value.maxWidth
  } else if (sidebarWidth < expandedFormRightSidebarState.value.minWidth) {
    expandedFormRightSidebarState.value.width = expandedFormRightSidebarState.value.minWidth
  } else {
    expandedFormRightSidebarState.value.width = sidebarWidth
  }
}

let timerId: any

watch(
  () => route.query.rowId,
  (rowId) => {
    clearTimeout(timerId)
    if (rowId) {
      timerId = setTimeout(() => {
        isReadySidebar.value = true
        clearTimeout(timerId)
      }, 300)
    } else {
      isReadySidebar.value = false
    }
  },
  {
    immediate: true,
  },
)

onBeforeUnmount(() => {
  clearTimeout(timerId)
})
</script>

<template>
  <Splitpanes
    class="nc-expanded-form-right-sidebar-content-resizable-wrapper w-full h-full"
    @resize="(event: any) => onResize(event[1].size)"
  >
    <Pane :size="expandedFormPreviewSize" class="flex-1 h-full">
      <slot />
    </Pane>
    <Pane
      v-if="isExpandedFormSidebarEnabled && isReadySidebar && route.query.rowId"
      id="nc-expanded-form-sidebar-splitpane"
      min-size="15%"
      class="nc-expanded-form-sidebar-splitpane"
      :size="expandedFormRightSidebarWidthPercent"
      :style="{
        minWidth: `${expandedFormRightSidebarState.minWidth}px !important`,
        maxWidth: `${normalizeExpandedFormSidebarWidth}px !important`,
      }"
    >
      <!-- <slot name="sidebar" /> -->
    </Pane>
  </Splitpanes>
</template>

<style lang="scss" scoped>
.nc-expanded-form-sidebar-splitpane {
  @apply rounded-l-xl !bg-transparent;
}
</style>

<style lang="scss">
/** Split pane CSS */

.nc-expanded-form-right-sidebar-content-resizable-wrapper > {
  .splitpanes__splitter {
    @apply !w-0 relative overflow-visible;
  }
  .splitpanes__splitter:before {
    @apply bg-transparent w-0.25 absolute left-0 top-[12px] h-[calc(100%_-_24px)] rounded-full z-1001;
    content: '';
  }

  .splitpanes__splitter:hover:before {
    @apply bg-scrollbar;
    width: 3px !important;
    left: 0px;
  }

  .splitpanes--dragging .splitpanes__splitter:before {
    @apply bg-scrollbar;
    width: 3px !important;
    left: 0px;
  }

  .splitpanes--dragging .splitpanes__splitter {
    @apply w-1 mr-0;
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
</style>
