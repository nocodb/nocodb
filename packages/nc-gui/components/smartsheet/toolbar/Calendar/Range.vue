<script lang="ts" setup>
import { type CalendarRangeType, FormulaDataTypes, UITypes } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'

const meta = inject(MetaInj, ref())

const { $api } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const IsPublic = inject(IsPublicInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { loadViewColumns } = useViewColumnsOrThrow()

const { loadCalendarMeta, loadCalendarData, loadSidebarData, fetchActiveDates, updateCalendarMeta, viewMetaProperties } =
  useCalendarViewStoreOrThrow()

const { isFeatureEnabled } = useBetaFeatureToggle()

const isRangeEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.CALENDAR_VIEW_RANGE))

const calendarRangeDropdown = ref(false)

const showWeekends = computed({
  get: () => !viewMetaProperties.value?.hide_weekend,
  set: (newValue) => {
    updateCalendarMeta({
      meta: {
        hide_weekend: !newValue,
      },
    })
  },
})

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

const saveCalendarRanges = async () => {
  if (activeView.value) {
    try {
      const calRanges = _calendar_ranges.value
        .filter((range) => range.fk_from_column_id)
        .map((range) => ({
          fk_from_column_id: range.fk_from_column_id,
          fk_to_column_id: range.fk_to_column_id,
        }))
      await $api.dbView.calendarUpdate(activeView.value?.id as string, {
        calendar_range: calRanges as CalendarRangeType[],
      })

      if (activeView.value.view) activeView.value.view.calendar_range = calRanges

      await loadCalendarMeta()
      await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
      // calendarRangeDropdown.value = false
    } catch (e) {
      console.log(e)
      message.error('There was an error while updating view!')
    }
  } else {
    message.error('Please select a view first')
  }
}

/*
const removeRange = async (id: number) => {
  _calendar_ranges.value = _calendar_ranges.value.filter((_, i) => i !== id)
  await saveCalendarRanges()
}
*/

const isDisabled = computed(() => {
  return (
    [UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime, UITypes.Formula].includes(
      dateFieldOptions.value.find((f) => f.value === calendarRange.value[0]?.fk_from_column_id)?.uidt,
    ) && !isRangeEnabled.value
  )
})

const onValueChange = async () => {
  _calendar_ranges.value = _calendar_ranges.value.map((range, i) => {
    if (i === 0) {
      return {
        fk_from_column_id: range.fk_from_column_id,
        fk_to_column_id: undefined,
      }
    }
    return range
  })
}
</script>

<template>
  <NcDropdown
    v-if="!IsPublic"
    v-model:visible="calendarRangeDropdown"
    :trigger="['click']"
    class="!xs:hidden"
    overlay-class-name="overflow-hidden"
  >
    <NcTooltip :disabled="!isToolbarIconMode" class="nc-calendar-btn">
      <template #title>
        {{ $t('activity.settings') }}
      </template>

      <NcButton
        v-e="['c:calendar:change-calendar-range']"
        class="nc-toolbar-btn !border-0 group !h-6"
        size="small"
        type="secondary"
        data-testid="nc-calendar-range-btn"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-2">
          <component :is="iconMap.calendar" class="h-4 w-4" />
          <span v-if="!isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">
            {{ $t('activity.settings') }}
          </span>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div v-if="calendarRangeDropdown" class="w-108 space-y-6 rounded-2xl p-6" data-testid="nc-calendar-range-menu" @click.stop>
        <div
          v-for="(range, id) in _calendar_ranges"
          :key="id"
          class="flex flex-col w-full gap-2 mb-2"
          data-testid="nc-calendar-range-option"
        >
          <span class="text-gray-800">
            {{ $t('labels.organiseBy') }}
          </span>

          <a-select
            v-model:value="range.fk_from_column_id"
            class="nc-select-shadow w-full !rounded-lg"
            dropdown-class-name="!rounded-lg"
            :placeholder="$t('placeholder.notSelected')"
            data-testid="nc-calendar-range-from-field-select"
            :disabled="isLocked"
            @change="
              () => {
                onValueChange()
                saveCalendarRanges()
              }
            "
            @click.stop
          >
            <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>
            <a-select-option
              v-for="(option, opId) in [...(dateFieldOptions ?? [])].filter((r) => {
                if (id === 0) return true
                const firstRange = (dateFieldOptions ?? []).find((f) => f.value === calendarRange[0].fk_from_column_id)
                return firstRange?.uidt === r.uidt
              })"
              :key="opId"
              :value="option.value"
            >
              <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                  <SmartsheetHeaderIcon :column="option" />

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
          <div v-if="isEeUI" class="w-full space-y-2">
            <NcTooltip v-if="range.fk_to_column_id === null && isRangeEnabled" placement="left" :disabled="!isDisabled">
              <NcButton
                size="small"
                data-testid="nc-calendar-range-add-end-date"
                class="w-23"
                type="text"
                :shadow="false"
                :disabled="isLocked || isDisabled"
                @click="range.fk_to_column_id = undefined"
              >
                <div class="flex gap-1 items-center">
                  <component :is="iconMap.plus" class="h-4 w-4" />
                  {{ $t('activity.endDate') }}
                </div>
              </NcButton>
              <template #title> Coming Soon!! Currently, range support is only available for Date field. </template>
            </NcTooltip>

            <template v-else-if="isEeUI">
              <span>
                {{ $t('activity.withEndDate') }}
              </span>
              <div class="flex">
                <a-select
                  v-model:value="range.fk_to_column_id"
                  class="!rounded-r-none nc-select-shadow w-full flex-1"
                  allow-clear
                  :disabled="!range.fk_from_column_id || isLocked || isDisabled"
                  :placeholder="$t('placeholder.notSelected')"
                  data-testid="nc-calendar-range-to-field-select"
                  dropdown-class-name="!rounded-lg"
                  @change="saveCalendarRanges"
                  @click.stop
                >
                  <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>

                  <a-select-option
                    v-for="(option, opId) in [...dateFieldOptions].filter((f) => {
                      const firstRange = dateFieldOptions.find((f) => f.value === calendarRange[0].fk_from_column_id)
                      return firstRange?.uidt === f.uidt && f.value !== range.fk_from_column_id
                    })"
                    :key="opId"
                    :value="option.value"
                  >
                    <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                      <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                        <SmartsheetHeaderIcon :column="option" />

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
              </div>
            </template>
          </div>
        </div>

        <div v-if="!isSetup" class="flex items-center gap-2 !mt-2">
          <GeneralIcon icon="warning" class="text-sm mt-0.5 text-orange-500" />
          <span class="text-sm text-gray-500"> Date field is required! </span>
        </div>

        <div>
          <NcSwitch v-model:checked="showWeekends" :disabled="isLocked">
            <span class="text-gray-800 font-semibold">
              {{ $t('activity.showSaturdaysAndSundays') }}
            </span>
          </NcSwitch>
        </div>

        <!--
        <div class="text-[13px] text-gray-500 py-2">Records in this view will be based on the specified date field.</div>
-->
        <GeneralLockedViewFooter v-if="isLocked" class="!-mb-4 -mx-4" @on-open="calendarRangeDropdown = false" />
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-to-select .ant-select-selector {
  @apply !rounded-r-none;
}
</style>
