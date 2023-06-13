<script lang="ts" setup>
import { GridItem, GridLayout } from 'vue3-grid-layout-next'
import type { WidgetTemplate } from './types'
import { useDashboardStore } from '~~/store/dashboard'
import '~/assets/dashboardLayout.scss'
const dashboardStore = useDashboardStore()
const { focusedWidget, openedLayoutSidebarNode, gridLayout } = storeToRefs(dashboardStore)
const {
  updatePositionOfWidgetById,
  updateScreenDimensionsOfWidgetById,
  addWidget,
  removeWidgetById,
  resetFocus,
  updateFocusedWidgetByElementId,
} = dashboardStore

const mainArea = ref<any>()

const drop = (ev: DragEvent) => {
  const item = JSON.parse(ev.dataTransfer?.getData('text/plain') || '{}') as WidgetTemplate
  addWidget(item.type)
}

const movedEvent = async (i: string, x: number, y: number) => {
  await updatePositionOfWidgetById(i, {
    x,
    y,
  })
}

const resizedEvent = async (i: any, height: any, width: any) => {
  await updateScreenDimensionsOfWidgetById(i, {
    width,
    height,
  })
}

const gridMargins = computed(() => {
  const gap = parseInt(openedLayoutSidebarNode.value?.grid_gap || '50') || 50
  return [gap, gap]
})
</script>

<template>
  <div class="flex flex-col">
    <LayoutsTopBar />
    <div class="flex">
      <LayoutsWidgetsLibraryPanel />
      <div ref="mainArea" class="min-h-10 flex-1 overflow-y-auto" @click="resetFocus" @dragover.prevent @drop="drop">
        <!-- TODO: Ugly hack - the GridLayout 3rd party component doesn't re-render automtically when gridMargin is changing; 
      So we enforce a re-render via setting they key to gridMargins -->
        <GridLayout
          :key="`${JSON.stringify(gridMargins)}`"
          v-model:layout="gridLayout"
          :style="{
            margin: `${openedLayoutSidebarNode?.grid_padding_vertical || '10'}px ${
              openedLayoutSidebarNode?.grid_padding_horizontal || '10'
            }px`,
          }"
          :margin="gridMargins"
          :is-draggable="true"
          :is-resizable="true"
          :use-css-transforms="true"
          :vertical-compact="false"
          :prevent-collision="false"
          :row-height="30"
          :col-num="4"
          :responsive="false"
          style="height: '100%'"
        >
          <GridItem
            v-for="item in gridLayout"
            :key="item.i"
            :static="item.static"
            :x="item.x"
            :y="item.y"
            :w="item.w"
            :h="item.h"
            :i="item.i"
            style="touch-action: none"
            @moved="movedEvent"
            @resized="resizedEvent"
          >
            <LayoutsFocusableWidget :widget-id="item.widgetId" />
          </GridItem>
        </GridLayout>
      </div>
      <!-- TODO: decide / change again to rem for width and overall: use consistent styling -->
      <div class="w-[420px] p-4">
        <LayoutsWidgetsPropertiesPanel />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.vue-grid-item {
  padding: 3px;
  border-radius: 24px;
}

.vue-grid-item .resizing {
  opacity: 0.9;
}

.vue-grid-item .no-drag {
  height: 100%;
  width: 100%;
}

.vue-grid-item .minMax {
  font-size: 12px;
}

.vue-grid-item .add {
  cursor: pointer;
}

.vue-draggable-handle {
  // position: absolute;
  // width: 20px;
  // height: 20px;
  // top: 0;
  // left: 0;
  // background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><circle cx='5' cy='5' r='5' fill='#999999'/></svg>")
  //   no-repeat;
  // background-position: bottom right;
  // padding: 0 8px 8px 0;
  // background-repeat: no-repeat;
  // background-origin: content-box;
  // box-sizing: border-box;
  // cursor: pointer;
}
</style>
