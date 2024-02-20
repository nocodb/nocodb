<script lang="ts" setup>
import {isSystemColumn, UITypes} from 'nocodb-sdk'
import type {SelectProps} from 'ant-design-vue'
import {
  ActiveViewInj,
  computed,
  iconMap,
  inject,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  ref,
  useSmartsheetStoreOrThrow,
  useViewColumnsOrThrow,
  watch,
} from '#imports'

const {eventBus} = useSmartsheetStoreOrThrow()

const meta = inject(MetaInj, ref())

const { $e } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const IsPublic = inject(IsPublicInj, ref(false))

const {fields, loadViewColumns, metaColumnById} = useViewColumnsOrThrow()


const calendarRangeDropdown = ref(false)

watch(
    () => activeView.value?.id,
    async (newVal, oldVal) => {
      if (newVal !== oldVal && meta.value) {
        await loadViewColumns()
        // For now we are adding a calendar range by default
        // TODO: Remove this when we have a way to add calendar range
        await addCalendarRange()
      }
    },
    {immediate: true},
)

// TODO: Fetch calendar range from viewColumnsComposable
const calendarRange = computed<{ fk_from_column_id: string; fk_to_column_id: string | null }[]>(() => {
  const tempCalendarRange: { fk_from_column_id: string; fk_to_column_id: string | null }[] = []
  // Object.values(fields.value).forEach((col) => {
  //   if (col.calendar_range) {
  //     tempCalendarRange.push({
  //       fk_from_col_id: col.fk_from_column_id,
  //       fk_to_column_id: col.fk_to_column_id,
  //     })
  //   }
  // })
  return tempCalendarRange
})

// We keep the calendar range here and update it when the user selects a new range
const _calendar_ranges = ref<{ fk_from_column_id: string; fk_to_column_id: string | null }[]>([])

const saveCalendarRanges = async () => {
  if(activeView.value) {
      try {
          for(const range of _calendar_ranges.value) {
              if(!range.fk_from_column_id) continue;
              // TODO: Update calendar range in viewColumnsComposable

              $e('c:calendar:change-calendar-range', {
                  viewId: activeView.value.id,
                  fk_from_column_id: range.fk_from_column_id,
                  fk_to_column_id: range.fk_to_column_id,
              })
          }
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
  return meta.value?.columns
      ?.filter((c) => {
        if (c.uidt === UITypes.Date || c.uidt === UITypes.DateTime && !isSystemColumn(c)) {
          return true
        }
      })
      .map((c) => ({
        label: c.title,
        value: c.id,
      })) ?? []
})

</script>

<template>
  <NcDropdown v-if="!IsPublic" v-model:visible="calendarRangeDropdown" :trigger="['click']" class="!xs:hidden">
    <div class="nc-calendar-btn">
      <a-button v-e="['c:calendar:change-calendar-range']" :disabled="isLocked"
                class="nc-calendar-range-btn nc-toolbar-btn">
        <div class="flex items-center gap-2">
          <component :is="iconMap.calendar" class="h-4 w-4"/>
          <span class="text-capitalize !text-sm font-medium">
            {{ $t('activity.viewSettings') }}
          </span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
          v-if="calendarRangeDropdown"
          class="flex flex-col w-full p-6 w-[40rem]"
          @click.stop
      >
        <div>
          <span class="font-bold"> {{ $t('activity.calendar') + $t('activity.viewSettings') }}</span>
          <a-divider class="!my-2"/>
        </div>
        <div v-for="cal in _calendar_ranges" class="flex w-full gap-3">
          <div class="flex flex-col w-1/2">
            <span>
              {{ $t('labels.selectDateField') }}
            </span>
            <NcSelect
                :value="cal.fk_from_column_id"
                :options="dateFieldOptions"
                class="w-full"
                @click.stop
                @change="saveCalendarRanges"
            />
          </div>
          <div v-if="cal.fk_to_column_id === null" class="flex flex-col justify-end w-1/2">
            <div class="cursor-pointer flex items-center font-medium gap-1 mb-1"
                 @click="cal.fk_to_column_id = ''">
              <component :is="iconMap.plus" class="h-4 w-4"/>
              {{ $t('activity.setEndDate') }}
            </div>

          </div>
          <div v-if="isEeUI && cal.fk_to_column_id !== null" class="flex flex-col w-1/2">
            <div class="flex flex-row justify-between">

            <span>
              {{ $t('labels.selectEndDateField') }}
            </span>
              <component :is="iconMap.delete" class="h-4 w-4 cursor-pointer text-red-500"
                         @click="cal.fk_to_column_id = null"/>
            </div>
            <NcSelect
                :value="cal.fk_to_column_id"
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
