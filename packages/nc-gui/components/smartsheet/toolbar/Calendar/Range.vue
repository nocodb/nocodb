<script lang="ts" setup>
import { type CalendarRangeType, UITypes, type ViewType, isSystemColumn } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'

const meta = inject(MetaInj, ref())

const { $api } = useNuxtApp()

const { t } = useI18n()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const IsPublic = inject(IsPublicInj, ref(false))

const { loadViewColumns } = useViewColumnsOrThrow()

const { refreshCommandPalette } = useCommandPalette()

const { loadCalendarMeta, loadCalendarData, loadSidebarData, fetchActiveDates, calendarMetaData } = useCalendarViewStoreOrThrow()

const calendarRangeDropdown = ref(false)

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
      await loadCalendarMeta()
      await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
    } catch (e) {
      console.log(e)
      message.error('There was an error while updating view!')
    }
  } else {
    message.error('Please select a view first')
  }
}

const dateFieldOptions = computed<SelectProps['options']>(() => {
  return (
    meta.value?.columns
      ?.filter((c) => c.uidt === UITypes.Date || (c.uidt === UITypes.DateTime && !isSystemColumn(c)))
      .map((c) => ({
        label: c.title,
        value: c.id,
        uidt: c.uidt,
      })) ?? []
  )
})
const addCalendarRange = async () => {
  _calendar_ranges.value.push({
    fk_from_column_id: dateFieldOptions.value![0].value as string,
    fk_to_column_id: null,
  })
  await saveCalendarRanges()
}
/*
const removeRange = async (id: number) => {
  _calendar_ranges.value = _calendar_ranges.value.filter((_, i) => i !== id)
  await saveCalendarRanges()
}

const saveCalendarRange = async (range: CalendarRangeType, value?) => {
  range.fk_to_column_id = value
  await saveCalendarRanges()
} */

const { viewsByTable, allRecentViews } = storeToRefs(useViewsStore())

const views = computed(() => viewsByTable.value.get(meta.value?.id ?? '')?.filter((v) => !v.is_default) ?? [])

function validate(view: Partial<ViewType>) {
  if (!view.title || !view.id) return t('msg.error.viewNameRequired')
  if (!view.title || view.title.trim().length < 0) {
    return t('msg.error.viewNameRequired')
  }

  if (views.value.some((v) => v.title === view.title && v.id !== view.id)) {
    return t('msg.error.viewNameDuplicate')
  }

  return true
}

const calendarTitle = ref('')

const renameView = async (title: string) => {
  if (!calendarMetaData.value || !meta.value) return

  if (title === calendarMetaData.value.title) return

  const res = validate({ title, id: calendarMetaData.value.fk_view_id })

  if (res !== true) {
    message.error(res)
    return
  }
  try {
    await $api.dbView.update(calendarMetaData.value.fk_view_id!, {
      title,
    })

    await refreshCommandPalette()

    allRecentViews.value = allRecentViews.value.map((rv) => {
      if (rv.viewId === calendarMetaData.value.fk_view_id && rv.tableID === meta.value.id) {
        rv.viewName = title
      }
      return rv
    })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e as any))
  }
}

const triggerRename = () => {
  renameView(calendarTitle.value)
}

watch(calendarRangeDropdown, (newVal) => {
  if (newVal) {
    calendarTitle.value = calendarMetaData.value?.title ?? ''
  }
})
</script>

<template>
  <NcDropdown v-if="!IsPublic" v-model:visible="calendarRangeDropdown" :trigger="['click']" class="!xs:hidden">
    <div class="nc-calendar-btn">
      <NcButton
        v-e="['c:calendar:change-calendar-range']"
        :disabled="isLocked"
        class="nc-toolbar-btn !border-0 group !h-6"
        size="small"
        type="secondary"
        data-testid="nc-calendar-range-btn"
      >
        <div class="flex items-center gap-2">
          <component :is="iconMap.calendar" class="h-4 w-4 transition-all group-hover:text-brand-500" />
          <span class="text-capitalize !group-hover:text-brand-500 !text-[13px] font-medium">
            {{ $t('activity.settings') }}
          </span>
        </div>
      </NcButton>
    </div>
    <template #overlay>
      <div v-if="calendarRangeDropdown" class="w-140 space-y-6 p-6" data-testid="nc-calendar-range-menu" @click.stop>
        <div>
          <div class="flex justify-between">
            <div class="flex items-center gap-3">
              <component :is="iconMap.calendar" class="text-maroon-500 w-5 h-5" />
              <span class="font-bold"> {{ `${$t('activity.calendar')} ${$t('activity.viewSettings')}` }}</span>
            </div>

            <a
              class="text-sm !text-gray-600 !font-default !hover:text-gray-600"
              href="`https://docs.nocodb.com/views/view-types/calendar`"
              target="_blank"
            >
              Go to Docs
            </a>
          </div>
          <NcDivider divider-class="!border-gray-200" />
        </div>

        <a-input
          v-model:value="calendarTitle"
          data-test-id="nc-view-name-input"
          placeholder="Calendar View"
          size="small"
          @blur="triggerRename"
        />

        <div
          v-for="(range, id) in _calendar_ranges"
          :key="id"
          class="flex w-full gap-2 mb-2 items-center"
          data-testid="nc-calendar-range-option"
        >
          <span>
            {{ $t('labels.organiseBy') }}
          </span>
          <NcSelect
            v-model:value="range.fk_from_column_id"
            :placeholder="$t('placeholder.notSelected')"
            data-testid="nc-calendar-range-from-field-select"
            @change="saveCalendarRanges"
          >
            <a-select-option
              v-for="(option, opId) in [...(dateFieldOptions ?? [])].filter((r) => {
                if (id === 0) return true
                const firstRange = (dateFieldOptions ?? []).find((f) => f.value === calendarRange[0].fk_from_column_id)
                return firstRange?.uidt === r.uidt
              })"
              :key="opId"
              :value="option.value"
            >
              <div class="flex items-center">
                <SmartsheetHeaderIcon :column="option" />
                <NcTooltip class="truncate flex-1 max-w-18" placement="top" show-on-truncate-only>
                  <template #title>{{ option.label }}</template>
                  {{ option.label }}
                </NcTooltip>

                <component
                  :is="iconMap.check"
                  v-if="option.value === range.fk_from_column_id"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </NcSelect>

          <!--          <div
            v-if="range.fk_to_column_id === null && isEeUI"
            class="flex cursor-pointer flex text-gray-800 items-center gap-1"
            data-testid="nc-calendar-range-add-end-date"
            @click="saveCalendarRange(range, undefined)"
          >
            <component :is="iconMap.plus" class="h-4 w-4" />
            {{ $t('activity.addEndDate') }}
          </div>
          <template v-else-if="isEeUI">
            <span>
              {{ $t('activity.withEndDate') }}
            </span>
            <div class="flex">
              <NcSelect
                v-model:value="range.fk_to_column_id"
                :disabled="!range.fk_from_column_id"
                :placeholder="$t('placeholder.notSelected')"
                class="!rounded-r-none nc-to-select"
                data-testid="nc-calendar-range-to-field-select"
                @change="saveCalendarRanges"
              >
                <a-select-option
                  v-for="(option, opId) in [...dateFieldOptions].filter((f) => {
                    const firstRange = dateFieldOptions.find((f) => f.value === calendarRange[0].fk_from_column_id)
                    return firstRange?.uidt === f.uidt
                  })"
                  :key="opId"
                  :value="option.value"
                >
                  <div class="flex items-center">
                    <SmartsheetHeaderIcon :column="option" />
                    <NcTooltip class="truncate flex-1 max-w-18" placement="top" show-on-truncate-only>
                      <template #title>{{ option.label }}</template>
                      {{ option.label }}
                    </NcTooltip>
                  </div>
                </a-select-option>
              </NcSelect>
              <NcButton class="!rounded-l-none !border-l-0" size="small" type="secondary" @click="saveCalendarRange(range, null)">
                <component :is="iconMap.delete" class="h-4 w-4" />
              </NcButton>
            </div>
          </template>

          <NcButton v-if="id !== 0" size="small" type="secondary" @click="removeRange(id)">
            <component :is="iconMap.close" />
          </NcButton>
            -->
        </div>

        <!--
        <div class="text-[13px] text-gray-500 py-2">Records in this view will be based on the specified date field.</div>
-->

        <NcButton
          v-if="_calendar_ranges.length === 0"
          class="mt-2"
          data-testid="nc-calendar-range-add-btn"
          size="small"
          type="secondary"
          @click="addCalendarRange"
        >
          <component :is="iconMap.plus" />
          Add date field
        </NcButton>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-to-select .ant-select-selector {
  @apply !rounded-r-none;
}

.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input {
  @apply px-3 h-8 rounded-lg py-1 w-full border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
