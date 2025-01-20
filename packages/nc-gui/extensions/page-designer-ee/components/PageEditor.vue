<script setup lang="ts">
import { type PageDesignerPayload } from '../src/payload'
import { PageDesignerLayout } from '../src/layout'

const props = defineProps<{
  payload: PageDesignerPayload
}>()

const pageSize = computed(() =>
  PageDesignerLayout.getPageSizePx(props.payload.layout?.pageType, props.payload.layout?.orientation),
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
    <div class="layout-wrapper flex-1 overflow-auto">
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
      </div>
    </div>
    <div class="w-[420px]">Sidebar</div>
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
