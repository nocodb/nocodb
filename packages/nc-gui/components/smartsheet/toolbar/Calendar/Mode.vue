<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'

const props = defineProps<{
  tab?: boolean
}>()

const { changeCalendarView, activeCalendarView, viewMetaProperties, customCount, customUnit } = useCalendarViewStoreOrThrow()

const { updateViewMeta } = useViewsStore()

const { $e } = useNuxtApp()

const { isMobileMode } = useGlobal()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const { t } = useI18n()

const isTab = computed(() => props.tab)

const dropdownOpen = ref(false)

const highlightStyle = ref<{ left: string; width?: string }>({ left: '0px' })

// Which pane the dropdown shows: the mode list, or the custom-timescale config.
const panel = ref<'list' | 'custom'>('list')

// Draft count/unit edited inside the custom panel; applied only on "Set".
const draftCount = ref<number>(customCount.value)

const draftUnit = ref<'day' | 'week'>(customUnit.value)

const countInputRef = ref<{ focus?: () => void } | null>(null)

// The count must be an integer within 1–6 (a-input-number can be cleared to null).
const isDraftCountValid = computed(() => {
  const value = draftCount.value
  return ncIsNumber(value) && Number.isInteger(value) && value >= 1 && value <= 6
})

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

const unitOptions = computed<{ value: 'day' | 'week'; label: string }[]>(() => [
  { value: 'day', label: t('objects.days') },
  { value: 'week', label: t('objects.weeks') },
])

// Label shown on the dropdown trigger. For custom, render "<count> <unit>" (e.g. "2 Days").
const triggerLabel = computed(() => {
  if (activeCalendarView.value !== 'custom') return t(modeI18nKey(activeCalendarView.value))
  const unitKey =
    customUnit.value === 'week'
      ? customCount.value > 1
        ? 'objects.weeks'
        : 'objects.week'
      : customCount.value > 1
      ? 'objects.days'
      : 'objects.day'
  return `${customCount.value} ${t(unitKey)}`
})

// Move focus back to the count input so Enter applies. Used on open and after the user
// picks a unit (which would otherwise leave focus on the select).
function focusCountInput() {
  nextTick(() => countInputRef.value?.focus?.())
}

// Open the custom config pane, seeding the draft from the persisted (or current) values.
function openCustomPanel() {
  draftCount.value = customCount.value
  draftUnit.value = customUnit.value
  panel.value = 'custom'
  focusCountInput()
}

function selectMode(mode: 'day' | '3day' | 'week' | '2week' | 'month' | '6week' | 'year') {
  changeCalendarView(mode)
  dropdownOpen.value = false
}

function applyCustom() {
  if (!isDraftCountValid.value) return
  changeCalendarView('custom', { count: draftCount.value, unit: draftUnit.value })
  dropdownOpen.value = false
}

function cancelCustom() {
  dropdownOpen.value = false
}

// Weekend display (Show / Collapse / Hide) lives in the mode dropdown and is only
// meaningful for week-or-longer ranges. Persisted as two mutually-exclusive
// booleans on the calendar view meta.
type WeekendDisplay = 'show' | 'collapse' | 'hide'

// Modes that show the weekend section (week-or-longer ranges). All three options
// (Show / Collapse / Hide) are available in each. Custom + week-unit qualifies too;
// custom + day-unit is day-anchored (like 3day) and has no weekend options.
const weekendSupportedModes = ['week', '2week', 'month', '6week']

const supportsWeekendOptions = computed(
  () =>
    weekendSupportedModes.includes(activeCalendarView.value) ||
    (activeCalendarView.value === 'custom' && customUnit.value === 'week'),
)

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

// Reset to the mode list when the dropdown OPENS (not on close) so a prior custom-pane
// state doesn't carry over — and the custom pane fades out cleanly on close instead of
// flashing the mode list during the close animation.
watch(dropdownOpen, (open) => {
  if (open) panel.value = 'list'
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
        <span class="whitespace-nowrap" data-testid="nc-calendar-view-mode-label">{{ triggerLabel }}</span>
        <GeneralIcon v-if="!isMobileMode" icon="arrowDown" class="flex-none text-nc-content-gray-subtle h-4 w-4" />
      </div>
    </NcButton>

    <template #overlay>
      <!-- Mode list -->
      <NcMenu v-if="panel === 'list'" class="!min-w-36" variant="small" data-testid="nc-calendar-view-mode-menu">
        <NcMenuItem
          v-for="option in modes"
          :key="option"
          :data-testid="`nc-calendar-view-mode-option-${option}`"
          inner-class="w-full"
          @click="() => selectMode(option)"
        >
          <div class="flex-1 text-[13px]">{{ $t(modeI18nKey(option)) }}</div>
          <GeneralIcon
            v-if="option === activeCalendarView"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-nc-content-brand w-4 h-4"
          />
        </NcMenuItem>

        <NcMenuItem
          v-e="['c:calendar:custom-timescale:open']"
          data-testid="nc-calendar-view-mode-option-custom"
          inner-class="w-full"
          @click="openCustomPanel"
        >
          <div class="flex-1 text-[13px]">{{ $t('objects.custom') }}…</div>
          <GeneralIcon
            v-if="activeCalendarView === 'custom'"
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
            @click="
              () => {
                setWeekendDisplay(opt.value)
                dropdownOpen = false
              }
            "
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

      <!-- Custom timescale config -->
      <form
        v-else
        class="nc-calendar-custom-timescale flex flex-col gap-3 p-4 w-64 bg-nc-bg-default rounded-lg"
        data-testid="nc-calendar-custom-timescale"
        @click.stop
      >
        <label class="text-bodyDefaultSm text-nc-content-gray" for="nc-calendar-custom-count-input">
          {{ $t('labels.timescale') }}
        </label>
        <!-- One combo box: numeric count + borderless unit select, with the standard input shadow. -->
        <div
          class="nc-calendar-custom-combo flex items-center w-full h-8 rounded-lg border-1 border-nc-border-gray-medium shadow-default hover:shadow-hover focus-within:shadow-selected focus-within:border-nc-border-brand transition-all overflow-hidden"
        >
          <a-input-number
            id="nc-calendar-custom-count-input"
            ref="countInputRef"
            v-model:value="draftCount"
            :min="1"
            :max="6"
            :precision="0"
            :controls="false"
            :bordered="false"
            placeholder="1-6"
            class="nc-calendar-custom-count flex-1 min-w-0"
            data-testid="nc-calendar-custom-count"
            @press-enter="applyCustom"
          />
          <NcSelect
            v-model:value="draftUnit"
            :options="unitOptions"
            :bordered="false"
            :dropdown-match-select-width="false"
            class="nc-calendar-custom-unit flex-none"
            data-testid="nc-calendar-custom-unit"
            dropdown-class-name="nc-calendar-custom-unit-dropdown"
            @change="focusCountInput"
          />
        </div>
        <div class="flex items-center justify-end gap-2 mt-2">
          <NcButton type="secondary" size="small" data-testid="nc-calendar-custom-cancel" @click="cancelCustom">
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton
            v-e="['c:calendar:custom-timescale:set', { unit: draftUnit }]"
            type="primary"
            size="small"
            :disabled="!isDraftCountValid"
            data-testid="nc-calendar-custom-set"
            inner-class="!px-1.5"
            @click="applyCustom"
          >
            {{ $t('general.set') }}
          </NcButton>
        </div>
      </form>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-calendar-mode-menu {
  :deep(.nc-menu-item-inner) {
    @apply !text-[13px];
  }
}

// Custom-timescale combo: the count input and unit select share one bordered box.
// Both render borderless; a faint divider separates the unit from the count.
.nc-calendar-custom-combo {
  :deep(.ant-input-number) {
    @apply h-full w-full bg-transparent shadow-none;

    .ant-input-number-input-wrap {
      @apply h-7.5;
    }
  }

  :deep(.ant-input-number-input) {
    @apply h-full px-3 text-[13px] text-nc-content-gray;
  }

  // Unit select sizes to its text (Days/Weeks); pr-7 leaves a tidy gap before the chevron
  // instead of the wide gap a full-width select produced.
  .nc-calendar-custom-unit {
    :deep(.ant-select-selector) {
      @apply h-full text-[13px] pl-2 pr-7 min-w-20 cursor-pointer transition-colors;
    }

    // Visible hover feedback on the select segment so it reads as an interactive dropdown.
    &:hover :deep(.ant-select-selector) {
      @apply bg-nc-bg-gray-light;
    }

    :deep(.ant-select-selection-item) {
      @apply text-nc-content-gray pr-0;
    }
  }
}
</style>
