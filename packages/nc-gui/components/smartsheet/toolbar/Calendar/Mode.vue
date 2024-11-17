<script lang="ts" setup>
const props = defineProps<{
  tab?: boolean
}>()

const { changeCalendarView, activeCalendarView } = useCalendarViewStoreOrThrow()

const isTab = computed(() => props.tab)

const highlightStyle = ref({ left: '0px' })

const setActiveCalendarMode = (mode: 'day' | 'week' | 'month' | 'year', event: MouseEvent) => {
  changeCalendarView(mode)
  const tabElement = event.target as HTMLElement
  highlightStyle.value.left = `${tabElement.offsetLeft}px`
}

const updateHighlightPosition = () => {
  nextTick(() => {
    const activeTab = document.querySelector('.nc-calendar-mode-tab .tab.active') as HTMLElement
    if (activeTab) {
      highlightStyle.value.left = `${activeTab.offsetLeft}px`
    }
  })
}

onMounted(() => {
  updateHighlightPosition()
})

watch(activeCalendarView, () => {
  if (!isTab.value) return
  updateHighlightPosition()
})
</script>

<template>
  <div
    v-if="isTab"
    class="flex flex-row px-1 pointer-events-auto mx-3 mt-3 rounded-lg gap-x-0.5 nc-calendar-mode-tab"
    data-testid="nc-calendar-view-mode"
  >
    <div :style="highlightStyle" class="highlight"></div>
    <div
      v-for="mode in ['day', 'week', 'month', 'year']"
      :key="mode"
      :class="{ active: activeCalendarView === mode }"
      :data-testid="`nc-calendar-view-mode-${mode}`"
      class="tab"
      @click="setActiveCalendarMode(mode, $event)"
    >
      <div class="tab-title !text-xs nc-tab">{{ $t(`objects.${mode}`) }}</div>
    </div>
  </div>

  <NcSelect v-else v-model:value="activeCalendarView" class="!w-21" data-testid="nc-calendar-view-mode" size="small">
    <a-select-option v-for="option in ['day', 'week', 'month', 'year']" :key="option" :value="option" class="!h-7 !w-21">
      <div class="flex gap-2 mt-0.5 items-center">
        <NcTooltip class="!capitalize flex-1 max-w-21" placement="top" show-on-truncate-only>
          <template #title>
            <span class="capitalize min-w-21">
              {{ option }}
            </span>
          </template>
          <span class="text-[13px]">
            {{ option }}
          </span>
        </NcTooltip>

        <component
          :is="iconMap.check"
          v-if="option === activeCalendarView"
          id="nc-selected-item-icon"
          class="text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NcSelect>
</template>

<style lang="scss" scoped>
.highlight {
  @apply absolute h-6.5 w-14 transition-all border-b-2 border-brand-500 duration-200;
  z-index: 0;
}

.nc-calendar-mode-menu {
  :deep(.nc-menu-item-inner) {
    @apply !text-[13px];
  }
}
.nc-select.ant-select {
  .ant-select-selector {
    @apply !px-3;
  }
}

.tab {
  @apply flex items-center h-7 w-14 z-10 justify-center px-2 py-1 rounded-lg gap-x-1.5 text-gray-500 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab .tab-title {
  @apply min-w-0 mb-3  pointer-events-none;
  word-break: keep-all;
  white-space: 'nowrap';
  display: 'inline';
  line-height: 0.95;
}

.active {
  @apply !text-brand-500 !font-bold  bg-transparent;
}

.nc-calendar-mode-tab {
  @apply relative;
}

:deep(.ant-select-selector) {
  @apply !h-7;
}
</style>
