<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import { PageDesignerLayout } from '../lib/layout'
import { PageDesignerWidgetFactory, PageDesignerWidgetType } from '../lib/widgets'
import PageDesignerText from './PageDesignerText.vue'
import PageDesignerImage from './PageDesignerImage.vue'
import PageDesignerDivider from './PageDesignerDivider'
import PropertiesPanel from './PropertiesPanel.vue'

const payload = inject(PageDesignerPayloadInj)!

const { fullscreen } = useExtensionHelperOrThrow()

const pageRef = ref<HTMLDivElement>()

const pageSize = computed(() => PageDesignerLayout.getPageSizePx(payload?.value?.pageType, payload?.value?.orientation))

const horizontalLines = computed(() => {
  const leftPixels: number[] = []
  for (let i = 10; i <= pageSize.value.width; i += 10) leftPixels.push(i)
  return leftPixels
})

const verticalLines = computed(() => {
  const topPixels: number[] = []
  for (let i = 10; i <= pageSize.value.height; i += 10) topPixels.push(i)
  return topPixels
})

const widgetTypeToComponent = {
  [PageDesignerWidgetType.TEXT]: PageDesignerText,
  [PageDesignerWidgetType.IMAGE]: PageDesignerImage,
  [PageDesignerWidgetType.DIVIDER]: PageDesignerDivider,
}

// onKeyStroke('Backspace', () => {
//   if (false && Number(payload.value.currentWidgetId) > 0) {
//     delete payload.value.widgets[payload.value.currentWidgetId]
//     payload.value.currentWidgetId = -1
//   }
// })

const widgetFactoryByType: Record<string, Function> = {
  [PageDesignerWidgetType.TEXT]: PageDesignerWidgetFactory.createEmptyTextWidget,
  [PageDesignerWidgetType.IMAGE]: PageDesignerWidgetFactory.createEmptyImageWidget,
  [PageDesignerWidgetType.DIVIDER]: PageDesignerWidgetFactory.createEmptyDividerWidget,
}

function onDropped(e: DragEvent) {
  const rect = pageRef.value?.getBoundingClientRect()
  if (!rect) return
  const widgetType = e.dataTransfer?.getData('text/plain') ?? ''
  const factory = widgetFactoryByType[widgetType]
  if (!factory) return
  const relativeX = e.clientX - rect.left
  const relativeY = e.clientY - rect.top
  const widget = factory(++payload.value.lastWidgetId, { x: relativeX, y: relativeY })
  payload.value.widgets[widget.id] = widget
  payload.value.currentWidgetId = widget.id
}
</script>

<template>
  <div class="h-full w-full flex">
    <div
      class="layout-wrapper flex-1 overflow-auto grid place-items-center"
      @drop="onDropped"
      @mousedown="payload.currentWidgetId = -1"
      @dragover.prevent
    >
      <div
        ref="pageRef"
        class="page relative flex-shrink-0"
        :style="{ width: `${pageSize.width}px`, height: `${pageSize.height}px` }"
      >
        <div class="grid-lines absolute top-0 left-0 h-full w-full">
          <div
            v-for="line in horizontalLines"
            :key="line"
            :style="{ left: `${line}px`, height: `${pageSize.height}px`, width: `1px` }"
          ></div>
          <div
            v-for="line in verticalLines"
            :key="line"
            :style="{ top: `${line}px`, width: `${pageSize.width}px`, height: `1px` }"
          ></div>
        </div>
        <template v-for="(widget, i) in payload?.widgets ?? {}" :key="i">
          <component
            :is="widgetTypeToComponent[widget.type]"
            :id="i"
            :active="+i === +payload.currentWidgetId"
            @mousedown.stop="payload.currentWidgetId = i"
          />
        </template>
      </div>
    </div>
    <PropertiesPanel v-if="fullscreen" />
  </div>
</template>

<style scoped lang="scss">
.layout-wrapper {
  @apply bg-nc-bg-gray-extralight;
  .page {
    margin: 40px;
    @apply bg-nc-bg-default;
    box-shadow: 0px 0px 12px 2px rgba(0, 0, 0, 0.08);
    .grid-lines {
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
      > div {
        background: lightgray;
        opacity: 40%;
        position: absolute;
      }
    }

    &:hover {
      .grid-lines {
        opacity: 1;
      }
    }
  }
}
</style>
