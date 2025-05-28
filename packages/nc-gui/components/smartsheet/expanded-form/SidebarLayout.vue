<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const slots = useSlots()

const {
  leftSidebarWidth,
  windowSize,
  expandedFormRightSidebarState,
  expandedFormRightSidebarWidthPercent,
  isExpandedFormSidebarEnabled,
} = storeToRefs(useSidebarStore())

const expandedFormPreviewSize = computed(() => {
  return 100 - expandedFormRightSidebarWidthPercent.value
})

function onResize(widthPercent: any) {
  const sidebarWidth = (widthPercent * (windowSize.value - leftSidebarWidth.value)) / 100

  if (sidebarWidth > expandedFormRightSidebarState.value.maxWidth) {
    expandedFormRightSidebarState.value.width = expandedFormRightSidebarState.value.maxWidth
  } else if (sidebarWidth < expandedFormRightSidebarState.value.minWidth) {
    expandedFormRightSidebarState.value.width = expandedFormRightSidebarState.value.minWidth
  } else {
    expandedFormRightSidebarState.value.width = sidebarWidth
  }
}

const normalizeExpandedFormSidebarWidth = computed(() => {
  if (expandedFormRightSidebarState.value.width > expandedFormRightSidebarState.value.maxWidth) {
    return expandedFormRightSidebarState.value.maxWidth
  } else if (expandedFormRightSidebarState.value.width < expandedFormRightSidebarState.value.minWidth) {
    return expandedFormRightSidebarState.value.minWidth
  } else {
    return expandedFormRightSidebarState.value.width
  }
})
</script>

<template>
  <Splitpanes
    class="nc-expanded-form-right-sidebar-content-resizable-wrapper w-full h-full relative"
    @resize="(event: any) => onResize(event[1].size)"
  >
    <Pane :size="expandedFormPreviewSize" class="flex-1 h-full relative">
      <slot name="preview" />
    </Pane>
    <Pane
      id="nc-expanded-form-sidebar-splitpane"
      min-size="15%"
      class="nc-expanded-form-sidebar-splitpane empty:hidden"
      :size="expandedFormRightSidebarWidthPercent"
      :style="{
        minWidth: `${expandedFormRightSidebarState.minWidth}px !important`,
        maxWidth: `${normalizeExpandedFormSidebarWidth}px !important`,
      }"
    >
      <slot name="sidebar" />
    </Pane>
  </Splitpanes>
</template>

<style lang="scss" scoped>
.nc-expanded-form-sidebar-splitpane {
  box-shadow: -8px 0px 16px -4px rgba(0, 0, 0, 0.16);
}
</style>

<style lang="scss">
/** Split pane CSS */

.nc-expanded-form-right-sidebar-content-resizable-wrapper > {
  .splitpanes__splitter {
    @apply !w-0 relative overflow-visible;
  }
  .splitpanes__splitter:before {
    @apply bg-gray-200 w-0.25 absolute left-0 top-0 h-full z-1001;
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
