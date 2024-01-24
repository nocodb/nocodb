<script lang="ts" setup>
import { useCalendarViewStoreOrThrow } from '#imports'

const { changeCalendarView, activeCalendarView } = useCalendarViewStoreOrThrow()

const highlightStyle = ref({ left: '0px' })

const setActiveCalendarMode = (mode: 'day' | 'week' | 'month' | 'year', event: MouseEvent) => {
  changeCalendarView(mode)
  const tabElement = event.target as HTMLElement
  highlightStyle.value.left = `${tabElement.offsetLeft}px`
}

onMounted(() => {
  const activeTab = document.querySelector('.nc-calendar-mode-tab .tab.active') as HTMLElement
  if (activeTab) {
    highlightStyle.value.left = `${activeTab.offsetLeft}px`
  }
})
</script>

<template>
  <div class="flex flex-row relative p-1 mx-3 mt-3 mb-3 bg-gray-100 rounded-lg gap-x-0.5 nc-calendar-mode-tab">
    <div :style="highlightStyle" class="highlight"></div>
    <div
      v-for="mode in ['day', 'week', 'month', 'year']"
      :key="mode"
      :class="{ active: activeCalendarView === mode }"
      class="tab"
      @click="setActiveCalendarMode(mode, $event)"
    >
      <div class="tab-title nc-tab">{{ $t(`objects.${mode}`) }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.highlight {
  @apply absolute h-7.5 w-20 shadow bg-white rounded-lg transition-all duration-300;
  z-index: 0;
}

.tab {
  @apply flex items-center h-7.5 w-20 z-10 justify-center px-2 py-1 rounded-lg gap-x-1.5 text-gray-500 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab .tab-title {
  @apply min-w-0 pointer-events-none;
  word-break: 'keep-all';
  white-space: 'nowrap';
  display: 'inline';
  line-height: 0.95;
}

.active {
  @apply text-black bg-transparent;
}

.nc-calendar-mode-tab {
  @apply mr-120 relative;
}
</style>
