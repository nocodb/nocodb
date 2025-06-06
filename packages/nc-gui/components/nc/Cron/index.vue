<script setup lang="ts">
import dayjs from 'dayjs'

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

const period = ref<string>('minute')
const minutes = ref<number>(15)
const hour = ref<number>(1)
const time = ref<number>(0)
const month = ref<number>(1)
const day = ref<number>(1)
const weekDays = ref<string[]>([])
const monthDays = ref<number[]>([])
const error = ref<boolean>(false)

const overlayOpen = reactive({
  isMonthDaysOpen: false,
  isWeekDaysOpen: false,
})

const weekDayNames = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
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
    <div class="flex flex-col gap-4">
      <label class="text-sm text-nc-content-gray-subtle font-semibold">Schedule</label>
      <div class="flex flex-wrap items-center gap-3 text-base">
        <span class="text-gray-700">Every</span>

        <a-select
          v-if="period === 'minute'"
          v-model:value="minutes"
          class="nc-cron-select"
          :disabled="disabled"
          @change="updateCronString"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option value="15">15</a-select-option>
          <a-select-option value="30">30</a-select-option>
          <a-select-option value="45">45</a-select-option>
          <a-select-option value="60">60</a-select-option>
        </a-select>

        <a-select
          v-else-if="period === 'hour'"
          v-model:value="hour"
          class="nc-cron-select"
          :disabled="disabled"
          @change="updateCronString"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option v-for="h in 24" :key="h" :value="h">{{ h }}</a-select-option>
        </a-select>

        <a-select
          v-else-if="period === 'day'"
          v-model:value="day"
          class="nc-cron-select"
          :disabled="disabled"
          @change="updateCronString"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option v-for="d in 30" :key="d" :value="d">{{ d }}</a-select-option>
        </a-select>

        <a-select
          v-else-if="period === 'month'"
          v-model:value="month"
          class="nc-cron-select"
          :disabled="disabled"
          @change="updateCronString"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option v-for="m in 12" :key="m" :value="m">{{ m }}</a-select-option>
        </a-select>

        <!-- Period Unit -->
        <a-select v-model:value="period" class="nc-cron-select" :disabled="disabled" @change="updateCronString">
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option value="minute">Minutes</a-select-option>
          <a-select-option value="hour">Hours</a-select-option>
          <a-select-option value="day">Days</a-select-option>
          <a-select-option value="week">Week</a-select-option>
          <a-select-option value="month">{{ month > 1 ? 'Months' : 'Month' }}</a-select-option>
        </a-select>

        <!-- Week Days Selection -->
        <template v-if="period === 'week'">
          <span class="text-gray-700">on</span>

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
        </template>

        <!-- Month Day Selection -->
        <template v-if="period === 'month'">
          <span class="text-gray-700">on</span>
          <NcDropdown v-model:visible="overlayOpen.isMonthDaysOpen" overlay-class-name="nc-cron-editor-dropdown">
            <div :class="{ open: overlayOpen.isMonthDaysOpen }" class="nc-cron-editor-dropdown-field">
              <span v-if="monthDays.length === 0">Select days</span>
              <span v-else class="truncate max-w-[100px]">{{ monthDays.join(', ') }}</span>
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
        </template>

        <!-- Time Selection for days, weeks, months -->
        <template v-if="['day', 'week', 'month'].includes(period)">
          <span class="text-gray-700">at</span>
          <a-select v-model:value="time" class="nc-cron-select-time" :disabled="disabled" @change="updateCronString">
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
            </template>
            <a-select-option v-for="interval in 96" :key="interval - 1" :value="interval - 1">
              {{
                dayjs()
                  .startOf('day')
                  .add((interval - 1) * 15, 'minutes')
                  .format('HH:mm A')
              }}
            </a-select-option>
          </a-select>
        </template>
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

.nc-cron-select {
  @apply capitalize !h-7 !min-w-[80px] bg-white;
}

.nc-cron-select-time {
  @apply !h-7 !min-w-[120px] bg-white;
}

:deep(.ant-select-selector) {
  @apply !h-7.5 border-gray-300;
}

:deep(.ant-select-selection-item) {
  @apply !h-7.5 flex items-center;
}
</style>
