<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import { PageDesignerLayout } from '../lib/layout'
import PageDesignerText from './PageDesignerText.vue'
import PageDesignerImage from './PageDesignerImage.vue'
import PropertiesPanel from './PropertiesPanel.vue'

const payload = inject(PageDesignerPayloadInj)!

const pageSize = computed(() =>
  PageDesignerLayout.getPageSizePx(payload?.value?.layout?.pageType, payload?.value?.layout?.orientation),
)

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
</script>

<template>
  <div class="h-full w-full flex">
    <div class="layout-wrapper flex-1 flex justify-center overflow-auto">
      <div class="page relative" :style="{ width: `${pageSize.width}px`, height: `${pageSize.height}px` }">
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
        <template v-for="(widget, i) in payload?.widgets ?? []" :key="i">
          <div @click="payload.currentWidgetIndex = i">
            <PageDesignerText v-if="widget.type === 'text'" :widget="widget" :active="payload.currentWidgetIndex === i" />
            <PageDesignerImage v-else-if="widget.type === 'image'" :widget="widget" :active="payload.currentWidgetIndex === i" />
          </div>
        </template>
      </div>
    </div>
    <PropertiesPanel />
  </div>
</template>

<style scoped lang="scss">
.layout-wrapper {
  @apply bg-nc-bg-gray-extralight;
  padding: 40px;
  .page {
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
