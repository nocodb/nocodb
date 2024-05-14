<script lang="ts" setup>
const props = defineProps<{
  tab?: boolean
}>()

const { changeCalendarView, activeCalendarView } = useCalendarViewStoreOrThrow()

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

watch(activeCalendarView, () => {
  if (!props.tab) return
  updateHighlightPosition()
})
</script>

<template>
  <div
    v-if="props.tab"
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
      <div class="tab-title nc-tab">{{ $t(`objects.${mode}`) }}</div>
    </div>
  </div>

  <div v-else>
    <NcDropdown :trigger="['click']">
      <NcButton class="!h-7 !w-20 !text-[13px]" data-testid="nc-calendar-view-mode" size="small" type="secondary">
        <div class="gap-2 flex items-center">
          {{ $t(`objects.${activeCalendarView}`) }}
          <component :is="iconMap.arrowDown" class="h-4 w-4" />
        </div>
      </NcButton>
      <template #overlay>
        <NcMenu class="nc-calendar-mode-menu">
          <NcMenuItem
            v-for="mode in ['day', 'week', 'month', 'year']"
            :key="mode"
            class="!text-[13px]"
            @click="changeCalendarView(mode)"
          >
            {{ $t(`objects.${mode}`) }}
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss" scoped>
.highlight {
  @apply absolute h-9 w-14 transition-all border-b-2 border-brand-500 duration-200;
  z-index: 0;
}

.nc-calendar-mode-menu {
  :deep(.nc-menu-item-inner) {
    @apply !text-[13px];
  }
}

.tab {
  @apply flex items-center h-9 w-14 z-10 justify-center px-2 py-1 rounded-lg gap-x-1.5 text-gray-500 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab .tab-title {
  @apply min-w-0 mb-3 pointer-events-none;
  word-break: keep-all;
  white-space: 'nowrap';
  display: 'inline';
  line-height: 0.95;
}

.active {
  @apply !text-brand-500  bg-transparent;
}

.nc-calendar-mode-tab {
  @apply relative;
}
</style>
