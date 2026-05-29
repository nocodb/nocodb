<script lang="ts" setup>
const props = defineProps<{
  tab?: boolean
}>()

const { changeCalendarView, activeCalendarView } = useCalendarViewStoreOrThrow()

const isTab = computed(() => props.tab)

const highlightStyle = ref({ left: '0px' })

const setActiveCalendarMode = (mode: 'day' | 'week' | '2week' | 'month' | '6week' | 'year', event: MouseEvent) => {
  changeCalendarView(mode)
  const tabElement = event.target as HTMLElement
  highlightStyle.value.left = `${tabElement.offsetLeft}px`
  highlightStyle.value.width = `${tabElement.offsetWidth}px`
}

const modeI18nKey = (mode: string) => {
  if (mode === '2week') return 'objects.twoWeek'
  if (mode === '6week') return 'objects.sixWeek'
  return `objects.${mode}`
}

const modes: Array<'day' | 'week' | '2week' | 'month' | '6week' | 'year'> = ['day', 'week', '2week', 'month', '6week', 'year']

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
  <div v-if="isTab" class="absolute left-[42%] top-0 bottom-0">
    <div
      class="px-1 pointer-events-auto relative mx-3 rounded-lg gap-x-0.5 nc-calendar-mode-tab"
      data-testid="nc-calendar-view-mode"
    >
      <div class="flex items-center flex-row">
        <div
          :style="highlightStyle"
          class="highlight h-0.5 rounded-t-md absolute transition-all -bottom-0.7 bg-nc-content-brand"
        ></div>

        <div
          v-for="mode in modes"
          :key="mode"
          :data-testid="`nc-calendar-view-mode-${mode}`"
          class="cursor-pointer tab transition-all px-1 duration-300 flex items-center h-10 z-10 justify-center"
          :class="{
            'text-nc-content-brand font-bold  bg-transparent active': activeCalendarView === mode,
            'text-nc-content-gray-subtle2 font-[500] hover:text-nc-content-gray-extreme ': activeCalendarView !== mode,
          }"
          @click="setActiveCalendarMode(mode, $event)"
        >
          <div class="min-w-0 pointer-events-none px-2 leading-[18px] text-[13px] transition-all duration-300 whitespace-nowrap">
            {{ $t(modeI18nKey(mode)) }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!--
    `option-label-prop="label"` makes the SELECTED chip render just the plain
    `label` string (not a clone of the full option template). Without it antd
    duplicates the `justify-between` + check-icon row into the chip, leaving
    the label visually off-centre and the wrong size.
    `:value` + `@change` (not `v-model`) routes selection through
    `changeCalendarView` so the view-meta default also gets persisted.
  -->
  <a-select
    v-else
    :value="activeCalendarView"
    class="nc-select-shadow !w-24 !rounded-lg"
    dropdown-class-name="!rounded-lg !min-w-28"
    size="small"
    option-label-prop="label"
    data-testid="nc-calendar-view-mode"
    @change="(value) => changeCalendarView(value as typeof modes[number])"
    @click.stop
  >
    <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>

    <a-select-option v-for="option in modes" :key="option" :value="option" :label="$t(modeI18nKey(option))">
      <div
        class="w-full flex gap-2 items-center justify-between text-[13px]"
        :data-testid="`nc-calendar-view-mode-option-${option}`"
        :title="$t(modeI18nKey(option))"
      >
        <div class="flex items-center gap-1">
          <NcTooltip class="flex-1 mt-0.5 truncate text-[13px]" show-on-truncate-only>
            <template #title>
              {{ $t(modeI18nKey(option)) }}
            </template>
            <template #default>{{ $t(modeI18nKey(option)) }}</template>
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

  // With option-label-prop="label" the chip renders just the plain label.
  // antd's default line-height is shorter than our 28px chip, so the text
  // hugs the top — match the line-height to the chip height to centre it.
  .ant-select-selection-item {
    @apply !text-[13px] !text-center !font-medium;
    line-height: 28px !important;
  }
}
</style>
