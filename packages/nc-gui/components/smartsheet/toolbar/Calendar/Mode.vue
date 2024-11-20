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
  highlightStyle.value.width = `${tabElement.offsetWidth}px`
}

const updateHighlightPosition = () => {
  nextTick(() => {
    const activeTab = document.querySelector('.nc-calendar-mode-tab .tab.active') as HTMLElement
    if (activeTab) {
      highlightStyle.value.left = `${activeTab.offsetLeft}px`
      highlightStyle.value.width = `${activeTab.offsetWidth}px`
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
    class="px-1 pointer-events-auto relative mx-3 mt-1 mb-2.5 rounded-lg gap-x-0.5 relative nc-calendar-mode-tab"
    data-testid="nc-calendar-view-mode"
  >
    <div class="flex flex-row">
      <div :style="highlightStyle" class="highlight h-0.5 rounded-t-md absolute transition-all -bottom-2.5 bg-brand-500"></div>
      <div
        v-for="mode in ['day', 'week', 'month', 'year']"
        :key="mode"
        :class="{ '!text-brand-500 !font-bold  bg-transparent active': activeCalendarView === mode }"
        :data-testid="`nc-calendar-view-mode-${mode}`"
        class="tab flex items-center h-7 w-14 z-10 justify-center px-2 py-1 rounded-lg gap-x-1.5 text-gray-600 hover:text-black cursor-pointer transition-all duration-300 select-none"
        @click="setActiveCalendarMode(mode, $event)"
      >
        <div class="min-w-0 pointer-events-none !text-[13px]]">{{ $t(`objects.${mode}`) }}</div>
      </div>
    </div>
  </div>

  <a-select
    v-else
    v-model:value="activeCalendarView"
    class="nc-select-shadow !w-21 !rounded-lg"
    dropdown-class-name="!rounded-lg"
    size="small"
    data-testid="nc-calendar-view-mode"
    @click.stop
  >
    <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>

    <a-select-option v-for="option in ['day', 'week', 'month', 'year']" :key="option" :value="option">
      <div class="w-full flex gap-2 items-center justify-between" :title="option">
        <div class="flex items-center gap-1">
          <NcTooltip class="flex-1 capitalize mt-0.5 truncate" show-on-truncate-only>
            <template #title>
              {{ option }}
            </template>
            <template #default>{{ option }}</template>
          </NcTooltip>
        </div>
        <GeneralIcon
          v-if="option === activeCalendarView"
          id="nc-selected-item-icon"
          icon="check"
          class="flex-none text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </a-select>
</template>

<style lang="scss" scoped>
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

:deep(.ant-select-selector) {
  @apply !h-7;
}
</style>
