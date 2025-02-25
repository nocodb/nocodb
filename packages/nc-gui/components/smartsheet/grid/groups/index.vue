<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import { useInfiniteGroups } from './useInfiniteGroups'
import { useCanvasTable } from './useCanvasTable'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const { xWhere } = useSmartsheetStoreOrThrow()

const {
  cachedGroups,
  groupByColumns,
  syncCount: syncGroupCount,
  totalGroups,
  fetchMissingGroupChunks,
  toggleExpand,
  chunkStates,
  GROUP_CHUNK_SIZE,
} = useInfiniteGroups(view, meta, xWhere)

const containerRef = ref<HTMLElement>()
const wrapperRef = ref<HTMLElement>()
const totalHeight = computed(() => totalGroups.value * 30)
const scrollTop = ref(0)
const scrollLeft = ref(0)
const { height, width } = useElementSize(wrapperRef)
const COLUMN_BUFFER_SIZE = 5

const { aggregations } = useViewAggregateOrThrow()

const { colSlice, groupSlice, renderCanvas, canvasRef, findColumnIndex, columnWidths } = useCanvasTable({
  scrollLeft,
  scrollTop,
  width,
  height,
  groupChunkStates: chunkStates,
  cachedGroups,
  totalGroups,
  aggregations,
  groupByColumns,
})

const calculateSlices = () => {
  const start = Math.max(0, Math.floor(scrollTop.value / 30))
  const end = Math.min(totalGroups.value, Math.ceil((scrollTop.value + height.value) / 30))
  if (start === groupSlice.value.start && end === groupSlice.value.end) return

  groupSlice.value = {
    start,
    end,
  }

  const startColIndex = Math.max(0, findColumnIndex(scrollLeft.value))
  const endColIndex = Math.min(
    columnWidths.value.length,
    findColumnIndex(scrollLeft.value + containerRef.value.clientWidth + COLUMN_BUFFER_SIZE) + 1,
  )

  if (startColIndex === colSlice.value.start && endColIndex === colSlice.value.end) return

  colSlice.value = {
    start: startColIndex,
    end: endColIndex,
  }

  fetchMissingGroupChunks(start, end - 1)
}

let rafnId: number | null = null

onMounted(async () => {
  await syncGroupCount()
  await fetchMissingGroupChunks(0, GROUP_CHUNK_SIZE - 1)
})
</script>

<template>
  <div ref="wrapperRef" class="h-full w-full overflow-auto">
    <div ref="containerRef" class="relative overflow-auto w-full h-full">
      <div class="w-full" :style="{ height: `${totalHeight}px` }">
        <canvas
          ref="canvasRef"
          class="sticky top-0 left-0"
          :height="`${height}px`"
          :width="`${width}px`"
          oncontextmenu="return false"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.h-30 {
  height: 30px;
}
</style>
