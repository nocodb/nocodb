<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'

const props = defineProps<{
  tab?: boolean
}>()

const { changeCalendarView, activeCalendarView, viewMetaProperties } = useCalendarViewStoreOrThrow()

const { updateViewMeta } = useViewsStore()

const { $e } = useNuxtApp()

const { isMobileMode } = useGlobal()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const { t } = useI18n()

const isTab = computed(() => props.tab)

const dropdownOpen = ref(false)

const highlightStyle = ref<{ left: string; width?: string }>({ left: '0px' })

const setActiveCalendarMode = (mode: 'day' | '3day' | 'week' | '2week' | 'month' | '6week' | 'year', event: MouseEvent) => {
  changeCalendarView(mode)
  const tabElement = event.target as HTMLElement
  highlightStyle.value.left = `${tabElement.offsetLeft}px`
  highlightStyle.value.width = `${tabElement.offsetWidth}px`
}

const modeI18nKey = (mode: string) => {
  if (mode === '3day') return 'objects.threeDay'
  if (mode === '2week') return 'objects.twoWeek'
  if (mode === '6week') return 'objects.sixWeek'
  return `objects.${mode}`
}

const modes: Array<'day' | '3day' | 'week' | '2week' | 'month' | '6week' | 'year'> = [
  'day',
  '3day',
  'week',
  '2week',
  'month',
  '6week',
  'year',
]

// Weekend display (Show / Collapse / Hide) lives in the mode dropdown and is only
// meaningful for week-or-longer ranges. Persisted as two mutually-exclusive
// booleans on the calendar view meta.
type WeekendDisplay = 'show' | 'collapse' | 'hide'

// Modes that show the weekend section (week-or-longer ranges). All three options
// (Show / Collapse / Hide) are available in each.
const weekendSupportedModes = ['week', '2week', 'month', '6week']

const supportsWeekendOptions = computed(() => weekendSupportedModes.includes(activeCalendarView.value))

const weekendDisplay = computed<WeekendDisplay>(() => {
  if (viewMetaProperties.value?.hide_weekend) return 'hide'
  if (viewMetaProperties.value?.collapse_weekend) return 'collapse'
  return 'show'
})

const weekendOptions = computed<{ value: WeekendDisplay; label: string }[]>(() => [
  { value: 'show', label: t('activity.showWeekends') },
  { value: 'collapse', label: t('activity.collapseWeekends') },
  { value: 'hide', label: t('activity.hideWeekends') },
])

const setWeekendDisplay = (value: WeekendDisplay) => {
  if (isLocked.value) return

  $e('c:calendar:weekend-display', { display: value })

  updateViewMeta(activeView.value?.id as string, ViewTypes.CALENDAR, {
    meta: {
      ...(viewMetaProperties.value || {}),
      hide_weekend: value === 'hide',
      collapse_weekend: value === 'collapse',
    },
  })
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

  <NcDropdown v-else v-model:visible="dropdownOpen" :trigger="['click']" overlay-class-name="!rounded-lg">
    <NcButton
      class="nc-select-shadow !h-7 !rounded-lg !shrink-0"
      :class="isMobileMode ? '!px-2' : '!px-3'"
      data-testid="nc-calendar-view-mode"
      size="small"
      type="secondary"
      @click.stop
    >
      <div class="flex items-center text-[13px] font-medium text-nc-content-gray" :class="isMobileMode ? 'gap-1' : 'gap-2'">
        <span class="whitespace-nowrap">{{ $t(modeI18nKey(activeCalendarView)) }}</span>
        <GeneralIcon v-if="!isMobileMode" icon="arrowDown" class="flex-none text-nc-content-gray-subtle h-4 w-4" />
      </div>
    </NcButton>

    <template #overlay>
      <NcMenu class="!min-w-36" variant="small" data-testid="nc-calendar-view-mode-menu" @click="dropdownOpen = false">
        <NcMenuItem
          v-for="option in modes"
          :key="option"
          :data-testid="`nc-calendar-view-mode-option-${option}`"
          inner-class="w-full"
          @click="changeCalendarView(option)"
        >
          <div class="flex-1 text-[13px]">{{ $t(modeI18nKey(option)) }}</div>
          <GeneralIcon
            v-if="option === activeCalendarView"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-nc-content-brand w-4 h-4"
          />
        </NcMenuItem>

        <template v-if="supportsWeekendOptions">
          <NcDivider />
          <NcMenuItem
            v-for="opt in weekendOptions"
            :key="opt.value"
            :data-testid="`nc-calendar-weekend-${opt.value}`"
            inner-class="w-full"
            @click="setWeekendDisplay(opt.value)"
          >
            <div class="flex-1 text-[13px]">{{ opt.label }}</div>
            <GeneralIcon
              v-if="weekendDisplay === opt.value"
              id="nc-selected-item-icon"
              icon="check"
              class="flex-none text-nc-content-brand w-4 h-4"
            />
          </NcMenuItem>
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-calendar-mode-menu {
  :deep(.nc-menu-item-inner) {
    @apply !text-[13px];
  }
}
</style>
