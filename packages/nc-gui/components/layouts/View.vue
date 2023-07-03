<script lang="ts" setup>
import type { ProjectType, Widget } from 'nocodb-sdk'
import { GridItem, GridLayout } from 'vue3-grid-layout-next'
import type { WidgetTemplate } from './types'
import { useDashboardStore } from '~~/store/dashboard'
import '~/assets/dashboardLayout.scss'

const dashboardStore = useDashboardStore()
const { openedLayoutSidebarNode, gridLayout } = storeToRefs(dashboardStore)
const { updatePositionOfWidgetById, updateScreenDimensionsOfWidgetById, addWidget, resetFocus } = dashboardStore

const mainArea = ref<any>()
const widgetForContextMenu = ref<Widget | null>(null)

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
const gap = computed(() => parseInt(openedLayoutSidebarNode.value?.grid_gap || '0') || 0)
const contextMenuVisible = ref(false)

const closeContextMenu = () => {
  contextMenuVisible.value = false
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
})

const showContextMenu = (top: number, left: number, widget: Widget) => {
  widgetForContextMenu.value = widget
  if (contextMenuRef.value == null) {
    return
  }
  contextMenuRef.value.style.top = `${top}px`
  contextMenuRef.value.style.left = `${left}px`
  contextMenuVisible.value = true
}

const { project } = useProject()
</script>

<template>
  <div class="flex flex-col h-screen">
    <LayoutsTopBar />
    <div class="flex-1 flex">
      <LayoutsWidgetsLibraryPanel />
      <div ref="mainArea" class="overflow-y-auto flex-1 border-10" @click="resetFocus" @dragover.prevent @drop="drop">
        <div class="flex border-b-1 text-xs py-2 border-gray-100 items-center">
          <GeneralIcon class="text-gray-500 mx-2" icon="table"></GeneralIcon>
          <h4 class="mb-0">{{ project.title }} / {{ openedLayoutSidebarNode?.title }}</h4>
        </div>
        <GridLayout
          v-model:layout="gridLayout"
          :style="{
            margin: `${openedLayoutSidebarNode?.grid_padding_vertical}px ${openedLayoutSidebarNode?.grid_padding_horizontal}px`,
          }"
          :is-draggable="true"
          :is-resizable="true"
          :vertical-compact="false"
          :prevent-collision="false"
          :row-height="48"
          :col-num="8"
          :responsive="false"
          style="height: '100%'"
          class="flex bg-red-300"
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
            <div
              class="nc-dashboard-widget-wrapper"
              :style="{
                width: `calc(100% - ${gap}px)`,
                height: `calc(100% - ${gap}px)`,
                left: `${gap / 2}px`,
                top: `${gap / 2}px`,
              }"
            >
              <LayoutsFocusableWidget :widget-id="item.widgetId" @show-context-menu-for-widget="showContextMenu" />
            </div>
          </GridItem>
        </GridLayout>
      </div>
      <div class="p-4 w-[280px] 2xl:w-[20vw] !overflow-y-auto h-[90vh]">
        <LayoutsWidgetsPropertiesPanel />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-dashboard-widget-wrapper {
  position: absolute;
}
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
</style>
