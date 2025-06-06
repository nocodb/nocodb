<script setup lang="ts">
import { ref, watch } from 'vue'
import dayjs from 'dayjs'
import { capitalizeFirstLetter } from '#imports'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'error'])

const period = ref<string>('day')
const minutes = ref<number>(15)
const hour = ref<number>(1)
const time = ref<number>(0)
const month = ref<number>(1)
const day = ref<number>(1)
const weekDays = ref<number[]>([])
const monthDays = ref<number[]>([])
const months = ref<number[]>([])
const error = ref<boolean>(false)

const overlayOpen = reactive({
  isMonthDaysOpen: false,
  isWeekDaysOpen: false,
})

const allowedPeriods = [
  {
    value: 'minute',
    label: 'Minute',
  },
  {
    value: 'hour',
    label: 'Hour',
  },
  {
    value: 'day',
    label: 'Day',
  },
  {
    value: 'week',
    label: 'Week',
  },
  {
    value: 'month',
    label: 'Month',
  },
]

const weekDayNames = [
  {
    value: 'monday',
    label: 'Monday',
  },
  {
    value: 'tuesday',
    label: 'Tuesday',
  },
  {
    value: 'wednesday',
    label: 'Wednesday',
  },
  {
    value: 'thursday',
    label: 'Thursday',
  },
  {
    value: 'friday',
    label: 'Friday',
  },
  {
    value: 'saturday',
    label: 'Saturday',
  },
  {
    value: 'sunday',
    label: 'Sunday',
  },
]

const monthDaysList = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: i + 1,
}))
/**
 * Helper function to calculate hour and minute from time value
 * @param timeValue - The time value (0-95, representing 15-minute intervals in a day)
 * @returns {Object} Object with hour and minute properties
 */
const calculateTimeValues = (timeValue: number) => {
  const hour = Math.floor(timeValue / 4)
  const minute = (timeValue % 4) * 15
  return { hour, minute }
}

/**
 * Converts the UI inputs to a cron expression
 * Format: minute hour day-of-month month day-of-week
 * @returns {string} The cron expression
 */
const getCronString = (): string => {
  let minute = '*'
  let hHour = '*'
  let dayOfMonth = '*'
  let monthValue = '*'
  let dayOfWeek = '*'

  try {
    switch (period.value) {
      case 'minute':
        // Every X minutes
        minute = `*/${minutes.value}`
        break

      case 'hour':
        // Every X hours
        minute = '0'
        hHour = `*/${hour.value}`
        break

      case 'day': {
        // Every X days
        const timeObj = calculateTimeValues(time.value)
        minute = timeObj.minute.toString()
        hHour = timeObj.hour.toString()
        dayOfMonth = `*/${day.value}`
        break
      }

      case 'week': {
        // Every X weeks on specific days
        const weekTimeObj = calculateTimeValues(time.value)
        minute = weekTimeObj.minute.toString()
        hHour = weekTimeObj.hour.toString()

        // Convert weekday names to cron numbers (0-6, where 0 is Sunday)
        if (weekDays.value.length > 0) {
          const weekDayMap: Record<string, number> = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
          }

          const cronWeekDays = weekDays.value.map((day) => weekDayMap[day]).sort()
          dayOfWeek = cronWeekDays.join(',')
        }
        break
      }

      case 'month': {
        // Every X months on specific days
        const monthTimeObj = calculateTimeValues(time.value)
        minute = monthTimeObj.minute.toString()
        hHour = monthTimeObj.hour.toString()

        // If specific days of month are selected
        if (monthDays.value.length > 0) {
          dayOfMonth = monthDays.value.sort((a, b) => a - b).join(',')
        }

        monthValue = `*/${month.value}`
        break
      }
    }

    return `${minute} ${hHour} ${dayOfMonth} ${monthValue} ${dayOfWeek}`
  } catch (e) {
    error.value = true
    emit('error', e)
    return ''
  }
}

const updateCronString = () => {
  const cronString = getCronString()
  emit('update:modelValue', cronString)
}

/**
 * Parses a cron expression and updates the UI inputs
 * @param {string} cronString - The cron expression to parse
 */
const parseCronString = (cronString: string) => {
  if (!cronString) return

  try {
    const parts = cronString.trim().split(' ')
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression format')
    }

    const [minutePart, hourPart, dayOfMonthPart, monthPart, dayOfWeekPart] = parts

    // Determine the period based on the cron parts
    if (minutePart.includes('/')) {
      // Every X minutes
      period.value = 'minute'
      minutes.value = parseInt(minutePart.split('/')[1], 10)
    } else if (hourPart.includes('/')) {
      // Every X hours
      period.value = 'hour'
      hour.value = parseInt(hourPart.split('/')[1], 10)
    } else if (dayOfMonthPart.includes('/')) {
      // Every X days
      period.value = 'day'
      day.value = parseInt(dayOfMonthPart.split('/')[1], 10)

      // Set time if specified
      if (minutePart !== '*' && hourPart !== '*') {
        const hourVal = parseInt(hourPart, 10)
        const minuteVal = parseInt(minutePart, 10)
        time.value = hourVal * 4 + Math.floor(minuteVal / 15)
      }
    } else if (monthPart.includes('/')) {
      // Every X months
      period.value = 'month'
      month.value = parseInt(monthPart.split('/')[1], 10)

      // Set time if specified
      if (minutePart !== '*' && hourPart !== '*') {
        const hourVal = parseInt(hourPart, 10)
        const minuteVal = parseInt(minutePart, 10)
        time.value = hourVal * 4 + Math.floor(minuteVal / 15)
      }

      // Set month days if specified
      if (dayOfMonthPart !== '*') {
        monthDays.value = dayOfMonthPart.split(',').map((d) => parseInt(d, 10))
      }
    } else if (dayOfWeekPart !== '*') {
      // Weekly schedule
      period.value = 'week'

      // Set weekdays
      const weekDayMap: Record<number, string> = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
      }

      weekDays.value = dayOfWeekPart.split(',').map((d) => weekDayMap[parseInt(d, 10)])

      // Set time if specified
      if (minutePart !== '*' && hourPart !== '*') {
        const hourVal = parseInt(hourPart, 10)
        const minuteVal = parseInt(minutePart, 10)
        time.value = hourVal * 4 + Math.floor(minuteVal / 15)
      }
    } else if (monthPart !== '*' && monthPart.includes(',')) {
      // Yearly schedule with specific months
      period.value = 'year'
      months.value = monthPart.split(',').map((m) => parseInt(m, 10))
    }

    error.value = false
  } catch (e) {
    error.value = true
    emit('error', e)
  }
}

const clearMonthDays = () => {
  monthDays.value = []
  updateCronString()
}

const clearWeekDays = () => {
  weekDays.value = []
  updateCronString()
}

const selectAllWeekDays = () => {
  weekDays.value = weekDayNames.map((c) => c.value)
  updateCronString()
}

const selectAllMonthDays = () => {
  monthDays.value = monthDaysList.map((c) => c.value)
  updateCronString()
}

// Watch for external changes to modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue && newValue !== getCronString()) {
      parseCronString(newValue)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="nc-cron-editor" @click.stop>
    <div class="flex flex-col gap-2">
      <label class="text-sm text-nc-content-gray-subtle font-semibold">Interval</label>
      <a-select
        v-model:value="period"
        class="nc-cron-select max-w-[200px] !h-7.5"
        :disabled="disabled"
        :placeholder="$t('general.select')"
        @change="updateCronString"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
        </template>
        <a-select-option v-for="p in allowedPeriods" :key="p.value" :value="p.value">
          <div class="flex items-center gap-2">
            <div class="flex-1">
              {{ p.label }}
            </div>
            <component
              :is="iconMap.check"
              v-if="p.value === period"
              id="nc-selected-item-icon"
              class="text-primary w-4 h-4 flex-none"
            />
          </div>
        </a-select-option>
      </a-select>
    </div>

    <div class="flex flex-col gap-2 mt-3 justify-center">
      <label class="text-sm text-nc-content-gray-subtle font-semibold">Timing</label>
      <div class="flex gap-2">
        <div v-if="['month'].includes(period)" class="nc-cron-field">
          <span>Every</span>
          <a-select
            v-model:value="month"
            class="nc-cron-select ml-2"
            :disabled="disabled"
            placeholder="# of"
            @change="updateCronString"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </template>
            <a-select-option v-for="m in 12" :key="m" :value="m">
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  {{ m.toString().padStart(2, '0') }}
                </div>
                <component
                  :is="iconMap.check"
                  v-if="m === month"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4 flex-none"
                />
              </div>
            </a-select-option>
          </a-select>
          <span>months</span>
        </div>

        <div v-if="['month'].includes(period)" class="nc-cron-field">
          <span>on the </span>
          <NcDropdown v-model:visible="overlayOpen.isMonthDaysOpen" overlay-class-name="nc-cron-editor-dropdown">
            <div
              :class="{
                open: overlayOpen.isMonthDaysOpen,
              }"
              class="nc-cron-editor-dropdown-field"
            >
              <span v-if="monthDays.length === 0">Select days</span>
              <span v-else class="truncate max-w-[150px]"> {{ monthDays.join(', ') }} </span>
            </div>
            <template #overlay>
              <NcList
                v-model:value="monthDays"
                variant="small"
                :list="monthDaysList"
                :open="overlayOpen.isMonthDaysOpen"
                :close-on-select="false"
                :disabled="disabled"
                is-multi-select
                placeholder="Select days"
                @change="updateCronString"
              >
                <template #listFooter>
                  <div class="flex mx-2 mb-2 pt-2 border-t-1 border-nc-border-gray items-center gap-2">
                    <NcButton class="flex-1 !text-nc-content-brand" size="xsmall" type="text" @click="selectAllMonthDays">
                      Select all
                    </NcButton>
                    <NcButton class="flex-1" size="xsmall" type="text" @click="clearMonthDays"> Clear </NcButton>
                  </div>
                </template>
              </NcList>
            </template>
          </NcDropdown>
        </div>

        <div v-if="['week'].includes(period)" class="nc-cron-field">
          <span>Every</span>
          <!--          <a-select
            v-model:value="week"
            class="nc-cron-select ml-2"
            :disabled="true"
            placeholder="# of"
            @change="updateCronString"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </template>
            <a-select-option v-for="w in 11" :key="w" :value="w">
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  {{ w.toString().padStart(2, '0') }}
                </div>
                <component
                  :is="iconMap.check"
                  v-if="w === week"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4 flex-none"
                />
              </div>
            </a-select-option>
          </a-select> -->
          <span>week</span>
        </div>

        <div v-if="['week'].includes(period)" class="nc-cron-field">
          <span>on</span>
          <NcDropdown v-model:visible="overlayOpen.isWeekDaysOpen" overlay-class-name="nc-cron-editor-dropdown">
            <div
              :class="{
                open: overlayOpen.isWeekDaysOpen,
              }"
              class="nc-cron-editor-dropdown-field"
            >
              <span v-if="weekDays.length === 0">Select weekdays</span>
              <span v-else>
                {{ weekDays.map((w) => capitalizeFirstLetter(w.slice(0, 3))).join(', ') }}
              </span>
            </div>
            <template #overlay>
              <NcList
                v-model:value="weekDays"
                variant="small"
                :open="overlayOpen.isWeekDaysOpen"
                :list="weekDayNames"
                :close-on-select="false"
                :disabled="disabled"
                is-multi-select
                placeholder="Select weekdays"
                @change="updateCronString"
              >
                <template #listFooter>
                  <div class="flex mx-2 mb-2 pt-2 border-t-1 border-nc-border-gray items-center gap-2">
                    <NcButton class="flex-1 !text-nc-content-brand" size="xsmall" type="text" @click="selectAllWeekDays">
                      Select all
                    </NcButton>
                    <NcButton class="flex-1" size="xsmall" type="text" @click="clearWeekDays"> Clear </NcButton>
                  </div>
                </template>
              </NcList>
            </template>
          </NcDropdown>
        </div>

        <div v-if="['day'].includes(period)" class="nc-cron-field">
          <span>Every</span>
          <a-select
            v-model:value="day"
            class="nc-cron-select ml-2"
            :disabled="disabled"
            placeholder="Find #"
            @change="updateCronString"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </template>
            <a-select-option v-for="d in 30" :key="d" :value="d">
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  {{ d.toString().padStart(2, '0') }}
                </div>
                <component
                  :is="iconMap.check"
                  v-if="d === day"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4 flex-none"
                />
              </div>
            </a-select-option>
          </a-select>
          <span>days</span>
        </div>
        <div v-if="['day', 'week', 'month'].includes(period)" class="nc-cron-field">
          <span v-if="['day', 'week', 'month'].includes(period)">at</span>
          <a-select
            v-model:value="time"
            class="nc-cron-selectml-2"
            :disabled="disabled"
            placeholder="Find #"
            @change="updateCronString"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </template>
            <a-select-option v-for="interval in 96" :key="interval - 1" :value="interval - 1">
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  {{
                    dayjs()
                      .startOf('day')
                      .add((interval - 1) * 15, 'minutes')
                      .format('HH:mm A')
                  }}
                </div>
                <component
                  :is="iconMap.check"
                  v-if="minutes === interval - 1"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4 flex-none"
                />
              </div>
            </a-select-option>
          </a-select>
        </div>
        <div v-if="['minute'].includes(period)" class="nc-cron-field">
          <span v-if="period === 'minute'">Every</span>
          <a-select
            v-model:value="minutes"
            class="nc-cron-select ml-2"
            :disabled="disabled"
            placeholder="Find #"
            @change="updateCronString"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </template>
            <a-select-option v-for="minute in 4" :key="minute" :value="minute * 15">
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  {{ (minute * 15).toString().padStart(2, '0') }}
                </div>
                <component
                  :is="iconMap.check"
                  v-if="minutes === minute * 15"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4 flex-none"
                />
              </div>
            </a-select-option>
          </a-select>
          <span>minutes</span>
        </div>
        <div v-if="['hour'].includes(period)" class="nc-cron-field">
          <span>Every</span>
          <a-select
            v-model:value="hour"
            class="nc-cron-select ml-2"
            :disabled="disabled"
            placeholder="Find #"
            @change="updateCronString"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </template>
            <a-select-option v-for="h in 24" :key="h" :value="h">
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  {{ h.toString().padStart(2, '0') }}
                </div>
                <component
                  :is="iconMap.check"
                  v-if="h === hour"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4 flex-none"
                />
              </div>
            </a-select-option>
          </a-select>
          <span>hours</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-cron-editor {
  @apply flex flex-col gap-2 bg-white rounded-xl;
  width: 100%;
}

.nc-cron-editor-dropdown-field {
  @apply border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 !min-w-[170px] transition-all cursor-pointer select-none text-sm;

  &.open {
    @apply shadow-selected border-nc-content-brand;
  }
}

.nc-cron-editor-dropdown {
  @apply rounded-2xl border-gray-200;
  box-shadow: 0px 20px 24px -4px rgba(0, 0, 0, 0.1), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}

.nc-cron-field {
  @apply flex gap-2 items-center;

  > label {
    @apply text-sm text-nc-content-gray-subtle font-semibold;
  }
}

.nc-cron-select {
  @apply capitalize !h-7 !min-w-[100px];

  .ant-select-selection-item {
    @apply !h-7;
  }

  :deep(.ant-select-selector) {
    @apply !h-7.5;
  }
}
</style>
