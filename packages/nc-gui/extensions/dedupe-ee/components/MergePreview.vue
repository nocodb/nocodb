<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'
import RecordCard from './RecordCard.vue'

const { mergeState, primaryRecordRowInfo, scrollTop, syncScrollTop } = useDedupeOrThrow()

const scrollContainer = ref<HTMLElement>()

// Synchronize scroll with ReviewStep component
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (target) {
    syncScrollTop(target.scrollTop)
  }
}

// Watch for scroll changes from the other component
watch(scrollTop, (newScrollTop) => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = newScrollTop
  }
})

watch(scrollContainer, () => {
  if (!scrollContainer.value) return

  scrollContainer.value.scrollTop = scrollTop.value
})
</script>

<template>
  <div
    v-if="ncIsNumber(mergeState.primaryRecordIndex) && primaryRecordRowInfo"
    class="border-l border-nc-border-gray-medium bg-nc-bg-gray-extralight min-w-[354px] flex-none"
  >
    <div class="px-4 py-2 min-h-[38px]">
      <h3 class="font-semibold m-0">Merge Preview</h3>
    </div>

    <div ref="scrollContainer" class="h-[calc(100%_-_38px)] nc-scrollbar-thin" @scroll="handleScroll">
      <div class="flex flex-col gap-4 children:flex-none px-4 pb-4 nc-scollbar-thin relative">
        <RecordCard :record="primaryRecordRowInfo" is-merge-record />
      </div>
    </div>
  </div>
</template>
