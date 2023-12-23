<script lang="ts" setup>
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import {
  ActiveViewInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  computed,
  iconMap,
  inject,
  ref,
  useSmartsheetStoreOrThrow,
  useViewColumnsOrThrow,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())

const { $api } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const IsPublic = inject(IsPublicInj, ref(false))

const { fields, loadViewColumns } = useViewColumnsOrThrow()

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

const calendarRange = computed<{ fk_from_column_id: string; fk_to_column_id: string | null }[]>(() => {
  const tempCalendarRange: { fk_from_column_id: string; fk_to_column_id: string | null }[] = []

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
const _calendar_ranges = ref<{ fk_from_column_id: string; fk_to_column_id: string | null }[]>(calendarRange.value)

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
        calendar_range: calRanges as { fk_from_column_id: string; fk_to_column_id: string | null }[],
      })
    } catch (e) {
      console.log(e)
      message.error('There was an error while updating view!')
    }
  } else {
    message.error('Please select a view first')
  }
}

// To add new calendar range
const addCalendarRange = async () => {
  _calendar_ranges.value.push({
    fk_from_column_id: '',
    fk_to_column_id: null,
  })
}

const dateFieldOptions = computed<SelectProps['options']>(() => {
  return (
    meta.value?.columns
      ?.filter((c) => c.uidt === UITypes.Date || (c.uidt === UITypes.DateTime && !isSystemColumn(c)))
      .map((c) => ({
        label: c.title,
        value: c.id,
      })) ?? []
  )
})
</script>

<template>
  <NcDropdown v-if="!IsPublic" v-model:visible="calendarRangeDropdown" :trigger="['click']" class="!xs:hidden">
    <div class="nc-calendar-btn">
      <a-button v-e="['c:calendar:change-calendar-range']" :disabled="isLocked" class="nc-calendar-range-btn nc-toolbar-btn">
        <div class="flex items-center gap-2">
          <component :is="iconMap.calendar" class="h-4 w-4" />
          <span class="text-capitalize !text-sm font-medium">
            {{ $t('activity.viewSettings') }}
          </span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div v-if="calendarRangeDropdown" class="flex flex-col w-full p-6 w-[40rem]" @click.stop>
        <div>
          <span class="font-bold"> {{ $t('activity.calendar') + $t('activity.viewSettings') }}</span>
          <a-divider class="!my-2" />
        </div>
        <div v-for="(cal, id) in _calendar_ranges" :key="id" class="flex w-full gap-3">
          <div class="flex flex-col gap-2 w-1/2">
            <span>
              {{ $t('labels.organizeRecordsBy') }}
            </span>
            <NcSelect
              v-model:value="cal.fk_from_column_id"
              :options="dateFieldOptions"
              class="w-full"
              @click.stop
              @change="saveCalendarRanges"
            />
          </div>
          <div v-if="cal.fk_to_column_id === null && isEeUI" class="flex flex-col justify-end w-1/2">
            <div class="cursor-pointer flex items-center font-medium gap-1 mb-1" @click="cal.fk_to_column_id = ''">
              <component :is="iconMap.plus" class="h-4 w-4" />
              {{ $t('activity.setEndDate') }}
            </div>
          </div>
          <div v-else-if="isEeUI" class="flex flex-col gap-2 w-1/2">
            <div class="flex flex-row justify-between">
              <span>
                {{ $t('labels.endDateField') }}
              </span>
              <component
                :is="iconMap.delete"
                class="h-4 w-4 cursor-pointer text-red-500"
                @click="
                  () => {
                    cal.fk_to_column_id = null
                    saveCalendarRanges()
                  }
                "
              />
            </div>
            <NcSelect
              v-model:value="cal.fk_to_column_id"
              :options="dateFieldOptions"
              :disabled="!cal.fk_from_column_id"
              :placeholder="$t('placeholder.notSelected')"
              class="w-full"
              @click.stop
              @change="saveCalendarRanges"
            />
          </div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>
