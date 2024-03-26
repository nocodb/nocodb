<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const { leftSidebarWidth, windowSize, formRightSidebarState, formRightSidebarWidthPercent } = storeToRefs(useSidebarStore())

const formPreviewSize = computed(() => 100 - formRightSidebarWidthPercent.value)

function onResize(widthPercent: any) {
  const sidebarWidth = (widthPercent * (windowSize.value - leftSidebarWidth.value)) / 100

  if (sidebarWidth > formRightSidebarState.value.maxWidth) {
    formRightSidebarState.value.width = formRightSidebarState.value.maxWidth
  } else if (sidebarWidth < formRightSidebarState.value.minWidth) {
    formRightSidebarState.value.width = formRightSidebarState.value.minWidth
  } else {
    formRightSidebarState.value.width = sidebarWidth
  }
}

const normalizeSidebarWidth = computed(() => {
  if (formRightSidebarState.value.width > formRightSidebarState.value.maxWidth) {
    return formRightSidebarState.value.maxWidth
  } else if (formRightSidebarState.value.width < formRightSidebarState.value.minWidth) {
    return formRightSidebarState.value.minWidth
  } else {
    return formRightSidebarState.value.width
  }
})
</script>

<template>
  <Splitpanes
    class="nc-form-right-sidebar-content-resizable-wrapper w-full h-full"
    @resize="(event: any) => onResize(event[1].size)"
  >
    <Pane :size="formPreviewSize" class="flex-1 h-full">
      <slot name="preview" />
    </Pane>
    <Pane
      min-size="15%"
      class="nc-sidebar-splitpane relative"
      :size="formRightSidebarWidthPercent"
      :style="{
        minWidth: `${formRightSidebarState.minWidth}px !important`,
        maxWidth: `${normalizeSidebarWidth}px !important`,
      }"
    >
      <slot name="sidebar" />
    </Pane>
  </Splitpanes>
</template>

<style lang="scss">
/** Split pane CSS */

.nc-form-right-sidebar-content-resizable-wrapper > {
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
