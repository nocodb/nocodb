<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import { useInfiniteGroups } from './useInfiniteGroups'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const { xWhere, eventBus } = useSmartsheetStoreOrThrow()
const isPublic = inject(IsPublicInj, ref(false))

const containerRef = ref<HTMLElement>()
const wrapperRef = ref<HTMLElement>()
const {
  cachedGroups,
  syncCount: syncGroupCount,
  totalGroups,
  groupByColumns,
  fetchMissingGroupChunks,
  toggleExpand,
  GROUP_CHUNK_SIZE,
} = useInfiniteGroups(view, meta, xWhere)

const totalHeight = computed(() => totalGroups.value * 30)

const groupSlice = reactive({
  start: 0,
  end: 100,
})

const visibleGroups = computed(() => {
  const groups = []
  for (let i = groupSlice.start; i < groupSlice.end && i < totalGroups.value; i++) {
    const group = cachedGroups.value.get(i)
    if (!group) {
      groups.push({
        column: groupByColumns.value[0]?.column || {},
        rows: new Map(),
        groups: new Map(),
        chunkStates: [],
        count: undefined,
        isExpanded: false,
        value: 'Loading...',
        groupIndex: i,
      })
    } else {
      groups.push({
        ...group,
        groupIndex: i,
      })
    }
  }
  return groups
})

const scrollTop = ref(0)
const scrollLeft = ref(0)

const { height } = useElementSize(wrapperRef)

const calculateSlices = () => {
  const start = Math.max(0, Math.floor(scrollTop.value / 30))
  const end = Math.min(totalGroups.value, Math.ceil((scrollTop.value + height.value) / 30))
  if (start === groupSlice.start && end === groupSlice.end) return

  groupSlice.start = start
  groupSlice.end = end
  fetchMissingGroupChunks(start, end - 1)
}

let rafnId = null

useScroll(containerRef, {
  throttle: 200,
  onScroll: async (e) => {
    if (rafnId) cancelAnimationFrame(rafnId)

    rafnId = requestAnimationFrame(() => {
      scrollTop.value = e.target.scrollTop
      scrollLeft.value = e.target.scrollLeft
      calculateSlices()
    })
  },
})

onMounted(async () => {
  await syncGroupCount()
  await fetchMissingGroupChunks(0, GROUP_CHUNK_SIZE - 1)
})
</script>

<template>
  <div ref="wrapperRef" class="h-full w-full overflow-auto">
    <div ref="containerRef" class="relative overflow-auto w-full h-full">
      <div class="w-full" :style="{ height: `${totalHeight}px` }">
        <div
          v-for="group in visibleGroups"
          :key="group.groupIndex"
          class="flex items-center h-[30px] bg-gray-100 w-full border-b border-gray-200 absolute"
          :style="{ top: `${group.groupIndex * 30}px` }"
          @click="toggleExpand(group)"
        >
          <div class="flex items-center w-full px-2">
            <span class="font-semibold">{{ group.value }}</span>
            <span class="ml-2 text-gray-600">({{ group.count ?? '...' }})</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.h-30 {
  height: 30px;
}
</style>
