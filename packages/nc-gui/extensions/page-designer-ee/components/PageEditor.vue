<script setup lang="ts">
import { isLinksOrLTAR } from 'nocodb-sdk'
import { PageDesignerPayloadInj } from '../lib/context'
import { PageDesignerLayout } from '../lib/layout'
import { type PageDesignerWidget, PageDesignerWidgetFactory, PageDesignerWidgetType } from '../lib/widgets'
import PageDesignerText from './PageDesignerText.vue'
import PageDesignerImage from './PageDesignerImage.vue'
import PageDesignerDivider from './PageDesignerDivider.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import PageDesignerField from './PageDesignerField.vue'
import PageDesignerLinkedField from './PageDesignerLinkedField.vue'

const props = defineProps<{
  miniPreview?: boolean
}>()

const payload = inject(PageDesignerPayloadInj)!

let deletedWidgets: PageDesignerWidget[] = []
let justDeleted = false
let justRestored = false

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
  [PageDesignerWidgetType.FIELD]: PageDesignerField,
  [PageDesignerWidgetType.LINKED_FIELD]: PageDesignerLinkedField,
}

const widgetFactoryByType: Record<string, Function> = {
  [PageDesignerWidgetType.TEXT]: PageDesignerWidgetFactory.createEmptyTextWidget,
  [PageDesignerWidgetType.IMAGE]: PageDesignerWidgetFactory.createEmptyImageWidget,
  [PageDesignerWidgetType.DIVIDER]: PageDesignerWidgetFactory.createEmptyDividerWidget,
}

function onDropped(e: DragEvent) {
  const rect = pageRef.value?.getBoundingClientRect()
  if (!rect) return
  const widgetData = e.dataTransfer?.getData('text/plain') ?? ''
  const relativeX = e.clientX - rect.left
  const relativeY = e.clientY - rect.top
  const position = { x: relativeX, y: relativeY }
  let field, widget: PageDesignerWidget
  try {
    field = JSON.parse(widgetData)
  } catch {
    return
  }
  if (!isNaN(+widgetData)) {
    const factory = widgetFactoryByType[widgetData]
    if (!factory) return
    widget = factory(position)
  } else {
    widget = isLinksOrLTAR(field)
      ? PageDesignerWidgetFactory.createEmptyLinkedFieldWidget(field, position)
      : PageDesignerWidgetFactory.createEmptyFieldWidget(field, position)
  }
  if (!widget) return
  PageDesignerWidgetFactory.create(payload, widget)
}

function unselectCurrentWidget() {
  payload.value.currentWidgetId = -1
}

function deleteCurrentWidget() {
  const widget = payload.value.widgets[payload.value.currentWidgetId]
  if (!widget) return
  justDeleted = true
  delete payload.value.widgets[payload.value.currentWidgetId]
  deletedWidgets.push(widget)
  unselectCurrentWidget()
}

onKeyStroke('Backspace', () => {
  if (payload.value.currentWidgetId === -1 || isActiveInputElementExist() || isDrawerOrModalExist() || isNcDropdownOpen()) return

  deleteCurrentWidget()
})

onKeyStroke(['z', 'Z'], (e) => {
  if (!e.metaKey) return
  if (deletedWidgets.length) {
    justRestored = true
    const deletedWidget = deletedWidgets.pop()!
    payload.value.widgets[deletedWidget.id] = deletedWidget
    payload.value.currentWidgetId = deletedWidget.id
  }
})

// watch for user changes and empty the deleted history
// if not caused by deleting and restoring the widgets
watch(
  () => {
    const { orientation, pageType, widgets, pageName, selectedTableId, selectedViewId } = payload.value
    return {
      orientation,
      pageType,
      widgets,
      pageName,
      selectedTableId,
      selectedViewId,
    }
  },
  () => {
    if (justDeleted) {
      justDeleted = false
      return
    }
    if (justRestored) {
      justRestored = false
      return
    }
    deletedWidgets = []
  },
  { deep: true },
)

function onWidgetClick(id: string | number) {
  payload.value.currentWidgetId = id
}

const el = useTemplateRef('el')
const { width } = useElementBounding(el)

const zoomLevel = computed(() => {
  if (!props.miniPreview) return 100

  const zoom = ((width.value - 80) / pageSize.value.width) * 100
  if (zoom > 100) return 100
  return zoom
})
</script>

<template>
  <div class="h-full w-full flex" :style="{ zoom: `${zoomLevel}%` }">
    <div
      ref="el"
      class="print-page-layout-wrapper flex-1 overflow-auto grid place-items-center"
      @drop="onDropped"
      @mousedown="unselectCurrentWidget"
      @dragover.prevent
    >
      <div
        id="printPage"
        ref="pageRef"
        class="page relative flex-shrink-0"
        :class="{
          'nc-page-preview-mode': payload.isPreviewMode && payload.currentWidgetId === -1 && fullscreen,
        }"
        :style="{ width: `${pageSize.width}px !important`, height: `${pageSize.height}px !important` }"
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
            class="page-widget"
            :class="{ 'active-page-widget': +i === +payload.currentWidgetId }"
            @delete-current-widget="deleteCurrentWidget"
            @mousedown.stop="onWidgetClick(i)"
          />
        </template>
      </div>
    </div>
    <PropertiesPanel v-if="fullscreen" @delete-current-widget="deleteCurrentWidget" />
  </div>
</template>

<style scoped lang="scss">
.print-page-layout-wrapper {
  @apply bg-nc-bg-gray-extralight;
  .page {
    @apply bg-nc-bg-default m-[40px];
    box-shadow: 0px 0px 12px 2px rgba(0, 0, 0, 0.08);
    .grid-lines {
      @apply opacity-0 transition-opacity duration-[0.5s] ease-in-out;
      > div {
        @apply opacity-[40%] absolute bg-nc-bg-gray-dark;
      }
    }

    &:hover {
      .grid-lines {
        @apply opacity-100;
      }
    }
  }
}
</style>
