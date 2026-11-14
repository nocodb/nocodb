<script lang="ts" setup>
import {
  type CalendarRangeType,
  FormulaDataTypes,
  MAX_CALENDAR_RANGES,
  PlanFeatureTypes,
  PlanTitles,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'

// Option value of "No end date" in the end-date picker
const NO_END_DATE = '__nc_no_end_date__'

const meta = inject(MetaInj, ref())

const { blockCalendarRange, getPlanTitle, showEEFeatures } = useEeConfig()

const { t } = useI18n()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const IsPublic = inject(IsPublicInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { loadViewColumns } = useViewColumnsOrThrow()

const viewStore = useViewsStore()

const { updateViewMeta } = viewStore

const { loadCalendarData, loadSidebarData, fetchActiveDates } = useCalendarViewStoreOrThrow()

const calendarRangeDropdown = ref(false)

// Index of the range whose end-date picker should open as soon as "+ End date" reveals it
const autoOpenEndIndex = ref<number | null>(null)

const dateFieldOptions = computed<SelectProps['options']>(() => {
  return (
    meta.value?.columns
      ?.filter(
        (c) =>
          [UITypes.DateTime, UITypes.Date, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(c.uidt) ||
          (c.uidt === UITypes.Formula && (c.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.DATE),
      )
      .map((c) => ({
        label: c.title,
        value: c.id,
        uidt: c.uidt,
        col: c,
      })) ?? []
  ).sort((a, b) => {
    const priority = {
      [UITypes.DateTime]: 1,
      [UITypes.Date]: 2,
      [UITypes.Formula]: 3,
      [UITypes.CreatedTime]: 4,
      [UITypes.LastModifiedTime]: 5,
    }

    return (priority[a.uidt] || 6) - (priority[b.uidt] || 6)
  })
})

watch(
  () => activeView.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

const calendarRange = computed<CalendarRangeType[]>(() => {
  const tempCalendarRange: CalendarRangeType[] = []

  if (!activeView.value || !activeView.value.view) return tempCalendarRange
  activeView.value.view.calendar_range?.forEach((range) => {
    tempCalendarRange.push({
      fk_from_column_id: range.fk_from_column_id,
      fk_to_column_id: range.fk_to_column_id,
      label: range.label,
    })
  })
  return tempCalendarRange
})

// We keep the calendar range here and update it when the user selects a new range
const _calendar_ranges = ref<CalendarRangeType[]>(calendarRange.value)

const isSetup = computed(() => {
  return _calendar_ranges.value.length > 0 && _calendar_ranges.value[0].fk_from_column_id
})

watch(
  calendarRangeDropdown,
  (newVal) => {
    if (!newVal && !isSetup.value) {
      calendarRangeDropdown.value = true
      if (_calendar_ranges.value.length === 0) {
        _calendar_ranges.value.push({
          fk_from_column_id: undefined,
          fk_to_column_id: null,
        })
      }
    }
  },
  { immediate: true },
)

// Update the local state from realtime
watch(calendarRange, () => {
  _calendar_ranges.value = calendarRange.value
})

const saveCalendarRanges = async () => {
  if (activeView.value) {
    try {
      const filled = _calendar_ranges.value.filter((range) => range.fk_from_column_id)
      const calRanges = filled.map((range) => ({
        fk_from_column_id: range.fk_from_column_id,
        fk_to_column_id: range.fk_to_column_id,
        // Labels only apply once there are several ranges
        label: filled.length > 1 ? range.label?.trim() || null : null,
      }))

      await updateViewMeta(activeView.value?.id as string, ViewTypes.CALENDAR, {
        calendar_range: calRanges as CalendarRangeType[],
      })

      await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
      // calendarRangeDropdown.value = false
    } catch (e: any) {
      // Put back the saved ranges so the menu doesn't show a value the server rejected
      _calendar_ranges.value = calendarRange.value.map((r) => ({ ...r }))
      message.error((await extractSdkResponseErrorMsg(e)) || t('msg.error.errorWhileUpdatingView'))
    }
  } else {
    message.error(t('msg.error.selectViewFirst'))
  }
}

const filterEndDateOptions = (options, startColumnId, index: number) => {
  if (!options || !startColumnId) return []

  const startColumn = meta.value?.columns?.find((c) => c.id === startColumnId)
  const startTimezone = startColumn?.meta?.timezone
  const used = getUsedColumnIds(index)
  const hasSeveralRanges = _calendar_ranges.value.length > 1

  return options.filter((option) => {
    const firstRange = dateFieldOptions.value.find((f) => f.value === startColumnId)
    const uidtMatches = firstRange?.uidt === option.uidt

    const optionColumn = meta.value?.columns?.find((c) => c.id === option.value)
    const timezoneMatches = optionColumn?.meta?.timezone === startTimezone
    return (
      uidtMatches &&
      option.value !== startColumnId &&
      timezoneMatches &&
      !used.has(option.value as string) &&
      !(hasSeveralRanges && option.uidt === UITypes.Formula)
    )
  })
}

// Fields taken by every range except the one at `index` (start and end)
function getUsedColumnIds(index: number) {
  return new Set(
    _calendar_ranges.value
      .flatMap((r, i) => (i === index ? [] : [r.fk_from_column_id, r.fk_to_column_id]))
      .filter((id): id is string => !!id),
  )
}

// With several ranges every range (the first included) must match the others' type and timezone;
// the backend accepts only plain date fields there, so formulas drop out
function getFromOptions(index: number) {
  const options = [...(dateFieldOptions.value ?? [])]
  const used = getUsedColumnIds(index)
  const reference = meta.value?.columns?.find((c) => c.id === _calendar_ranges.value[index === 0 ? 1 : 0]?.fk_from_column_id)

  if (!reference) return options.filter((o) => !used.has(o.value as string))

  return options.filter(
    (o) =>
      o.uidt !== UITypes.Formula &&
      o.uidt === reference.uidt &&
      o.col?.meta?.timezone === reference.meta?.timezone &&
      !used.has(o.value as string),
  )
}

const isRangeLimitReached = computed(() => _calendar_ranges.value.length >= MAX_CALENDAR_RANGES)

function addRange() {
  _calendar_ranges.value.push({ fk_from_column_id: undefined, fk_to_column_id: null })
}

async function removeRange(index: number) {
  _calendar_ranges.value = _calendar_ranges.value.filter((_, i) => i !== index)
  await saveCalendarRanges()
}

// The end-date options depend on the start field: keep the end date only while it still fits the new start
const onValueChange = (index: number) => {
  _calendar_ranges.value = _calendar_ranges.value.map((range, i) => {
    if (i !== index) return range

    const endStillValid =
      !!range.fk_to_column_id &&
      filterEndDateOptions(dateFieldOptions.value, range.fk_from_column_id, i).some((o) => o.value === range.fk_to_column_id)

    return {
      fk_from_column_id: range.fk_from_column_id,
      fk_to_column_id: endStillValid ? range.fk_to_column_id : range.fk_to_column_id === null ? null : undefined,
      label: range.label,
    }
  })
}

// Persist a label edit on blur / Enter, only when it differs from what is saved
function onLabelCommit(index: number) {
  const next = _calendar_ranges.value[index]?.label?.trim() || null
  const saved = calendarRange.value[index]?.label || null
  if (next !== saved) saveCalendarRanges()
}

function showEndDate(index: number) {
  _calendar_ranges.value[index].fk_to_column_id = undefined
  autoOpenEndIndex.value = index
}

// Picking "No end date" removes the end date and brings back "+ End date"
function onEndDateChange(index: number, value?: string) {
  _calendar_ranges.value[index].fk_to_column_id = value === NO_END_DATE ? null : value
  saveCalendarRanges()
}
</script>

<template>
  <NcDropDrawer
    v-if="!IsPublic"
    v-model:visible="calendarRangeDropdown"
    :trigger="['click']"
    drawer-content-height
    overlay-class-name="overflow-hidden"
  >
    <template #default="{ onClick }">
      <NcTooltip :disabled="!isToolbarIconMode" class="nc-calendar-btn">
        <template #title>
          {{ $t('activity.settings') }}
        </template>

        <NcButton
          v-e="['c:calendar:change-calendar-range']"
          class="nc-toolbar-btn !border-0 group !h-7"
          size="small"
          type="secondary"
          data-testid="nc-calendar-range-btn"
          :show-as-disabled="isLocked"
          @click="onClick"
        >
          <div class="flex items-center gap-2">
            <component :is="iconMap.calendar" class="h-4 w-4" />
            <span v-if="!isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">
              {{ $t('activity.settings') }}
            </span>
          </div>
        </NcButton>
      </NcTooltip>
    </template>

    <template #overlay>
      <div
        v-if="calendarRangeDropdown"
        class="nc-calendar-range-menu w-full sm:w-130 space-y-3 sm:rounded-2xl px-0 py-1 sm:p-4 max-h-[70vh] overflow-auto"
        data-testid="nc-calendar-range-menu"
        @click.stop
      >
        <div class="flex flex-col w-full gap-2">
          <span class="text-[13px] text-nc-content-gray mb-0.5">{{ $t('labels.organiseBy') }}</span>

          <!-- One row per range: start field, end date, remove -->
          <div
            v-for="(range, id) in _calendar_ranges"
            :key="id"
            class="nc-calendar-range-row"
            :class="{ 'nc-calendar-range-row-removable': _calendar_ranges.length > 1 && !isLocked }"
            data-testid="nc-calendar-range-option"
          >
            <a-select
              v-model:value="range.fk_from_column_id"
              class="nc-select-shadow w-full !rounded-lg"
              dropdown-class-name="!rounded-lg nc-calendar-range-dropdown"
              :placeholder="$t('placeholder.notSelected')"
              data-testid="nc-calendar-range-from-field-select"
              :disabled="isLocked"
              @change="
                () => {
                  onValueChange(id)
                  saveCalendarRanges()
                }
              "
              @click.stop
            >
              <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
              <a-select-option v-for="(option, opId) in getFromOptions(id)" :key="opId" :value="option.value">
                <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                  <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                    <SmartsheetHeaderIcon :column="option.col" class="nc-calendar-range-field-icon" />

                    <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                      <template #title>
                        {{ option.label }}
                      </template>
                      <template #default>{{ option.label }}</template>
                    </NcTooltip>
                  </div>
                  <GeneralIcon
                    v-if="option.value === range.fk_from_column_id"
                    id="nc-selected-item-icon"
                    icon="check"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </a-select>

            <PaymentUpgradeBadgeProvider v-if="showEEFeatures" :feature="PlanFeatureTypes.FEATURE_CALENDAR_RANGE">
              <template #default="{ click }">
                <div v-if="range.fk_to_column_id === null" class="flex">
                  <NcButton
                    size="small"
                    data-testid="nc-calendar-range-add-end-date"
                    type="text"
                    class="nc-calendar-range-text-btn"
                    :shadow="false"
                    :disabled="isLocked || !range.fk_from_column_id"
                    @click="click(PlanFeatureTypes.FEATURE_CALENDAR_RANGE, () => showEndDate(id))"
                  >
                    <div class="flex gap-2 items-center">
                      <component :is="iconMap.plus" class="h-3.5 w-3.5" />
                      {{ $t('activity.endDate') }}
                      <PaymentUpgradeBadge
                        :limit-or-feature="PlanFeatureTypes.FEATURE_CALENDAR_RANGE"
                        :content="$t('upgrade.upgradeToUseCalendarRangeSubtitle', { plan: getPlanTitle(PlanTitles.PLUS) })"
                        :feature="PlanFeatureTypes.FEATURE_CALENDAR_RANGE"
                      />
                    </div>
                  </NcButton>
                </div>

                <a-select
                  v-else
                  :value="range.fk_to_column_id"
                  class="nc-select-shadow w-full !rounded-lg"
                  :default-open="autoOpenEndIndex === id"
                  :autofocus="autoOpenEndIndex === id"
                  :disabled="!range.fk_from_column_id || isLocked || blockCalendarRange"
                  :placeholder="$t('placeholder.notSelected')"
                  data-testid="nc-calendar-range-to-field-select"
                  dropdown-class-name="!rounded-lg nc-calendar-range-dropdown"
                  @change="(value) => onEndDateChange(id, value)"
                  @dropdown-visible-change="(open) => !open && (autoOpenEndIndex = null)"
                  @click.stop
                >
                  <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>

                  <a-select-option :value="NO_END_DATE" data-testid="nc-calendar-range-no-end-date">
                    <span class="text-nc-content-gray-subtle">{{ $t('labels.noEndDate') }}</span>
                  </a-select-option>
                  <a-select-option
                    v-for="(option, opId) in filterEndDateOptions(dateFieldOptions, range.fk_from_column_id, id)"
                    :key="opId"
                    :value="option.value"
                  >
                    <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                      <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                        <SmartsheetHeaderIcon :column="option.col" class="nc-calendar-range-field-icon" />

                        <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                          <template #title>
                            {{ option.label }}
                          </template>
                          <template #default>{{ option.label }}</template>
                        </NcTooltip>
                      </div>
                      <GeneralIcon
                        v-if="option.value === range.fk_to_column_id"
                        id="nc-selected-item-icon"
                        icon="check"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </a-select>
              </template>
            </PaymentUpgradeBadgeProvider>
            <span v-else />

            <a-input
              v-if="_calendar_ranges.length > 1"
              v-model:value="range.label"
              class="nc-calendar-range-label-input !rounded-lg"
              :maxlength="40"
              :disabled="isLocked"
              :placeholder="$t('labels.rangeLabelPlaceholder')"
              data-testid="nc-calendar-range-label-input"
              @blur="onLabelCommit(id)"
              @press-enter="onLabelCommit(id)"
              @click.stop
            />

            <template v-if="_calendar_ranges.length > 1 && !isLocked">
              <NcTooltip v-if="id === 0" :title="$t('msg.info.firstCalendarRangeNotRemovable')">
                <NcButton
                  size="xsmall"
                  type="text"
                  class="!cursor-not-allowed"
                  :aria-label="$t('msg.info.firstCalendarRangeNotRemovable')"
                  aria-disabled="true"
                >
                  <GeneralIcon icon="delete" class="text-nc-content-gray-disabled" />
                </NcButton>
              </NcTooltip>
              <NcTooltip v-else :title="$t('general.remove')">
                <NcButton
                  v-e="['c:calendar:range:remove']"
                  size="xsmall"
                  type="text"
                  data-testid="nc-calendar-range-remove"
                  :aria-label="$t('general.remove')"
                  @click="removeRange(id)"
                >
                  <GeneralIcon icon="delete" />
                </NcButton>
              </NcTooltip>
            </template>
          </div>
        </div>

        <PaymentUpgradeBadgeProvider v-if="isEeUI && isSetup && !isLocked" :feature="PlanFeatureTypes.FEATURE_CALENDAR_RANGE">
          <template #default="{ click }">
            <NcTooltip :disabled="!isRangeLimitReached">
              <template #title>{{ $t('msg.info.maxCalendarRanges', { max: MAX_CALENDAR_RANGES }) }}</template>
              <NcButton
                v-e="['c:calendar:range:add']"
                size="small"
                type="text"
                class="nc-calendar-range-text-btn"
                :shadow="false"
                :disabled="
                  isRangeLimitReached ||
                  !_calendar_ranges[_calendar_ranges.length - 1]?.fk_from_column_id ||
                  getFromOptions(_calendar_ranges.length).length === 0
                "
                data-testid="nc-calendar-range-add"
                @click="click(PlanFeatureTypes.FEATURE_CALENDAR_RANGE, addRange)"
              >
                <div class="flex gap-2 items-center">
                  <component :is="iconMap.plus" class="h-3.5 w-3.5" />
                  {{ $t('activity.addDateRange') }}
                  <PaymentUpgradeBadge
                    :limit-or-feature="PlanFeatureTypes.FEATURE_CALENDAR_RANGE"
                    :title="$t('upgrade.upgradeToUseMultipleCalendarRanges')"
                    :content="$t('upgrade.upgradeToUseMultipleCalendarRangesSubtitle', { plan: getPlanTitle(PlanTitles.PLUS) })"
                    :feature="PlanFeatureTypes.FEATURE_CALENDAR_RANGE"
                  />
                </div>
              </NcButton>
            </NcTooltip>
          </template>
        </PaymentUpgradeBadgeProvider>

        <div v-if="!isSetup" class="flex items-center gap-2 !mt-2">
          <GeneralIcon icon="warning" class="text-sm mt-0.5 text-nc-content-orange-medium" />
          <span class="text-sm text-nc-content-gray-muted"> {{ $t('msg.dateFieldRequired') }} </span>
        </div>

        <GeneralLockedViewFooter v-if="isLocked" class="!-mb-4 -mx-4" @on-open="calendarRangeDropdown = false" />
      </div>
    </template>
  </NcDropDrawer>
</template>

<style lang="scss">
// Menu-item weight and size (matches the toolbar's other menus) instead of NcButton's 600 / 14px
.nc-calendar-range-text-btn,
.nc-calendar-range-text-btn * {
  font-weight: 450 !important;
  font-size: 13px !important;
}

.nc-calendar-range-menu .ant-select,
.nc-calendar-range-menu .nc-calendar-range-label-input {
  font-size: 13px;
}

// Field-type icons at the menu's 13px scale: lighter stroke and colour than the 16px default
.nc-calendar-range-menu,
.nc-calendar-range-dropdown {
  .nc-calendar-range-field-icon {
    width: 14px !important;
    height: 14px !important;
    color: var(--nc-content-gray-subtle);

    path {
      stroke-width: 1.33;
    }
  }
}

// The pickers' option lists render outside the menu
.nc-calendar-range-dropdown .ant-select-item {
  font-size: 13px;
}

.nc-calendar-range-row {
  @apply grid items-center gap-2;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);

  &:has(.nc-calendar-range-label-input) {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.8fr);
  }

  &.nc-calendar-range-row-removable {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 28px;

    &:has(.nc-calendar-range-label-input) {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.8fr) 28px;
    }
  }
}

.nc-to-select .ant-select-selector {
  @apply !rounded-r-none;
}
</style>
