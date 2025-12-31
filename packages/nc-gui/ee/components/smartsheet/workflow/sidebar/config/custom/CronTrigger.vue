<script setup lang="ts">
import { type TimeZone, getTimeZones } from '@vvo/tzdb'
import { CronExpressionParser } from 'cron-parser'
import { computed, ref, watch } from 'vue'
import { useWorkflowOrThrow } from '~/composables/useWorkflow'
import { iconMap } from '#imports'

const isSameTimezone = (tz1: string, tz2: string): boolean => {
  if (!tz1 || !tz2) return false
  if (tz1 === tz2) return true

  try {
    const formatter1 = new Intl.DateTimeFormat('en', { timeZone: tz1 })
    const formatter2 = new Intl.DateTimeFormat('en', { timeZone: tz2 })

    const date = new Date('2024-01-01T00:00:00')
    const offset1 = formatter1.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value
    const offset2 = formatter2.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value

    return offset1 === offset2
  } catch {
    return false
  }
}

type IntervalType = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly'

interface CronTriggerNodeConfig {
  cronExpression?: string
  timezone?: string
}

const { selectedNodeId, updateNode, selectedNode } = useWorkflowOrThrow()

const browserTzName = Intl.DateTimeFormat().resolvedOptions().timeZone

const config = computed<CronTriggerNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {}) as CronTriggerNodeConfig
})

const intervalType = ref<IntervalType>('minutes')

const intervalMinutes = ref(5)

const minuteOfHour = ref(0)

const hourOfDay = ref(0)

const dayOfWeek = ref(1)

const dayOfMonth = ref(1)

const isValidStepInterval = (values: readonly (number | string)[], expectedStep: number): boolean => {
  const numericValues = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b)
  if (numericValues.length < 2) return false

  for (let i = 1; i < numericValues.length; i++) {
    if (numericValues[i] - numericValues[i - 1] !== expectedStep) {
      return false
    }
  }
  return true
}

const parseCronExpression = (cronExpr: string) => {
  if (!cronExpr) return

  try {
    const interval = CronExpressionParser.parse(cronExpr)
    const fields = interval.fields

    const minuteValues = fields.minute.values
    const hourValues = fields.hour.values
    const dayOfMonthValues = fields.dayOfMonth.values
    const monthValues = fields.month.values
    const dayOfWeekValues = fields.dayOfWeek.values

    const isAllValues = (values: readonly (number | string)[], min: number, max: number) => {
      const numericValues = values.filter((v): v is number => typeof v === 'number')
      return numericValues.length === max - min + 1 && numericValues.every((v, i) => v === min + i)
    }

    // Check for minutes interval: */N * * * *
    if (
      minuteValues.length > 1 &&
      minuteValues.length < 60 &&
      minuteValues[0] === 0 &&
      minuteValues[1] !== undefined &&
      isAllValues(hourValues, 0, 23) &&
      isAllValues(dayOfMonthValues, 1, 31) &&
      isAllValues(monthValues, 1, 12) &&
      isAllValues(dayOfWeekValues, 0, 6)
    ) {
      // Check if it's a regular interval (e.g., every 5 minutes: 0, 5, 10, 15...)
      const step = minuteValues[1] - minuteValues[0]
      if (step > 0 && isValidStepInterval(minuteValues, step)) {
        intervalType.value = 'minutes'
        intervalMinutes.value = step
        return
      }
    }

    // Check for hourly: M * * * *
    if (
      minuteValues.length === 1 &&
      minuteValues[0] !== undefined &&
      isAllValues(hourValues, 0, 23) &&
      isAllValues(dayOfMonthValues, 1, 31) &&
      isAllValues(monthValues, 1, 12) &&
      isAllValues(dayOfWeekValues, 0, 6)
    ) {
      intervalType.value = 'hourly'
      minuteOfHour.value = minuteValues[0]
      return
    }

    // Check for weekly: M H * * D
    if (
      minuteValues.length === 1 &&
      minuteValues[0] !== undefined &&
      hourValues.length === 1 &&
      hourValues[0] !== undefined &&
      isAllValues(dayOfMonthValues, 1, 31) &&
      isAllValues(monthValues, 1, 12) &&
      dayOfWeekValues.length === 1 &&
      dayOfWeekValues[0] !== undefined
    ) {
      intervalType.value = 'weekly'
      minuteOfHour.value = minuteValues[0]
      hourOfDay.value = hourValues[0]
      dayOfWeek.value = dayOfWeekValues[0]
      return
    }

    // Check for monthly: M H D * *
    if (
      minuteValues.length === 1 &&
      minuteValues[0] !== undefined &&
      hourValues.length === 1 &&
      hourValues[0] !== undefined &&
      dayOfMonthValues.length === 1 &&
      dayOfMonthValues[0] !== undefined &&
      isAllValues(monthValues, 1, 12) &&
      isAllValues(dayOfWeekValues, 0, 6)
    ) {
      intervalType.value = 'monthly'
      minuteOfHour.value = minuteValues[0]
      hourOfDay.value = hourValues[0]
      dayOfMonth.value = dayOfMonthValues[0]
      return
    }

    // Check for daily: M H * * *
    if (
      minuteValues.length === 1 &&
      minuteValues[0] !== undefined &&
      hourValues.length === 1 &&
      hourValues[0] !== undefined &&
      isAllValues(dayOfMonthValues, 1, 31) &&
      isAllValues(monthValues, 1, 12) &&
      isAllValues(dayOfWeekValues, 0, 6)
    ) {
      intervalType.value = 'daily'
      minuteOfHour.value = minuteValues[0]
      hourOfDay.value = hourValues[0]
    }
  } catch (error) {
    console.error('Invalid cron expression:', error)
  }
}

if (config.value.cronExpression) {
  parseCronExpression(config.value.cronExpression)
}

watch(
  () => config.value.cronExpression,
  (newCronExpression) => {
    if (newCronExpression) {
      parseCronExpression(newCronExpression)
    }
  },
)

const minutesOptions = Array.from({ length: 60 }, (_, i) => i)
const hoursOptions = Array.from({ length: 24 }, (_, i) => i)

const daysOfWeekOptions = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]
const daysOfMonthOptions = Array.from({ length: 31 }, (_, i) => i + 1)

const generateCronExpression = (): string => {
  switch (intervalType.value) {
    case 'minutes':
      return `*/${intervalMinutes.value} * * * *`
    case 'hourly':
      return `${minuteOfHour.value} * * * *`
    case 'daily':
      return `${minuteOfHour.value} ${hourOfDay.value} * * *`
    case 'weekly':
      return `${minuteOfHour.value} ${hourOfDay.value} * * ${dayOfWeek.value}`
    case 'monthly':
      return `${minuteOfHour.value} ${hourOfDay.value} ${dayOfMonth.value} * *`
    default:
      return '*/5 * * * *'
  }
}

const timezones = getTimeZones({ includeUtc: true }).sort((a, b) => a.name.localeCompare(b.name))

const browserTz = timezones.find((tz) => isSameTimezone(tz.name, browserTzName))

const utcTz = timezones.find((tz) => tz.name === 'Etc/UTC')

const defaultSuggestedTzs = [browserTz, utcTz].filter((k) => k) as TimeZone[]

const priorityTzs = computed(() => {
  const otherPriorityTzs = []
  for (const tz of timezones) {
    if (
      browserTz?.countryCode === tz.countryCode &&
      !defaultSuggestedTzs.find((suggestedTz) => isSameTimezone(suggestedTz?.name, tz.name))
    ) {
      otherPriorityTzs.push(tz)
    }
  }
  return [...defaultSuggestedTzs, ...otherPriorityTzs]
})

const updateConfig = (updates: Partial<CronTriggerNodeConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
      testResult: {
        ...(selectedNode.value?.data?.testResult || {}),
        isStale: true,
      },
    },
  })
}

const updateIntervalConfig = () => {
  const cronExpr = generateCronExpression()
  updateConfig({
    cronExpression: cronExpr,
  })
}

watch([intervalType, intervalMinutes, minuteOfHour, hourOfDay, dayOfWeek, dayOfMonth], () => {
  updateIntervalConfig()
})

const onTimezoneChange = (value: string) => {
  updateConfig({ timezone: value || undefined })
}

const intervalOptions = [
  {
    label: 'Every specified minutes',
    value: 'minutes',
  },
  {
    label: 'Every hour',
    value: 'hourly',
  },
  {
    label: 'Every day',
    value: 'daily',
  },
  {
    label: 'Every week',
    value: 'weekly',
  },
  {
    label: 'Every month',
    value: 'monthly',
  },
]

watch(
  () => selectedNode.value,
  (node) => {
    if (!node) return
    const nodeConfig = (node.data?.config || {}) as CronTriggerNodeConfig

    const updates: Partial<CronTriggerNodeConfig> = {}
    let hasUpdates = false

    // Set default timezone if not present
    if (!nodeConfig.timezone && browserTzName) {
      updates.timezone = browserTzName
      hasUpdates = true
    }

    // Set default cronExpression if not present
    if (!nodeConfig.cronExpression) {
      updates.cronExpression = generateCronExpression()
      hasUpdates = true
    }

    if (hasUpdates) {
      updateNode(selectedNodeId.value, {
        data: {
          ...node.data,
          config: {
            ...nodeConfig,
            ...updates,
          },
        },
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <a-form class="nc-cron-trigger-config" layout="vertical">
    <a-form-item label="Interval">
      <NcSelect v-model:value="intervalType" @change="updateIntervalConfig">
        <a-select-option v-for="interval in intervalOptions" :key="interval.value" :value="interval.value">
          <div class="flex justify-between items-center">
            {{ interval.label }}
            <GeneralIcon
              v-if="interval.value === intervalType"
              id="nc-selected-item-icon"
              class="text-primary w-4 h-4"
              icon="ncCheck"
            />
          </div>
        </a-select-option>
      </NcSelect>
    </a-form-item>

    <!-- Minutes Interval Configuration -->
    <template v-if="intervalType === 'minutes'">
      <a-form-item label="Every minutes">
        <a-input-number
          v-model:value="intervalMinutes"
          :min="1"
          type="number"
          :controls="false"
          :max="60"
          class="nc-input-shadow !rounded-lg w-full"
          @change="updateIntervalConfig"
        />
        <div class="text-xs text-nc-content-gray-muted mt-1">Run every {{ intervalMinutes }} minutes</div>
      </a-form-item>
    </template>

    <!-- Hourly Interval Configuration -->
    <template v-if="intervalType === 'hourly'">
      <a-form-item label="Select minute">
        <NcSelect v-model:value="minuteOfHour" @change="updateIntervalConfig">
          <a-select-option v-for="minute in minutesOptions" :key="minute" :value="minute">
            <div class="flex items-center justify-between">
              {{ minute.toString().padStart(2, '0') }}
              <GeneralIcon
                v-if="minuteOfHour === minute"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
                icon="ncCheck"
              />
            </div>
          </a-select-option>
        </NcSelect>
        <div class="text-xs text-nc-content-gray-muted mt-1">
          Run at minute {{ minuteOfHour.toString().padStart(2, '0') }} of every hour
        </div>
      </a-form-item>
    </template>

    <!-- Daily Interval Configuration -->
    <template v-if="intervalType === 'daily'">
      <a-form-item label="Select time of the day">
        <div class="flex gap-2">
          <NcSelect v-model:value="hourOfDay" @change="updateIntervalConfig">
            <a-select-option v-for="hour in hoursOptions" :key="hour" :value="hour">
              <div class="flex items-center justify-between">
                {{ hour % 12 || 12 }} {{ hour >= 12 ? 'PM' : 'AM' }}
                <GeneralIcon v-if="hourOfDay === hour" id="nc-selected-item-icon" class="text-primary w-4 h-4" icon="ncCheck" />
              </div>
            </a-select-option>
          </NcSelect>
          <NcSelect v-model:value="minuteOfHour" @change="updateIntervalConfig">
            <a-select-option v-for="minute in minutesOptions" :key="minute" :value="minute">
              <div class="flex items-center justify-between">
                {{ minute.toString().padStart(2, '0') }}
                <GeneralIcon
                  v-if="minuteOfHour === minute"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                  icon="ncCheck"
                />
              </div>
            </a-select-option>
          </NcSelect>
        </div>
        <div class="text-xs text-nc-content-gray-muted mt-1">
          Run at {{ hourOfDay % 12 || 12 }}:{{ minuteOfHour.toString().padStart(2, '0') }}
          {{ hourOfDay >= 12 ? 'PM' : 'AM' }} every day
        </div>
      </a-form-item>
    </template>

    <!-- Weekly Interval Configuration -->
    <template v-if="intervalType === 'weekly'">
      <a-form-item label="Select time and day of the week">
        <div class="space-y-2">
          <NcSelect v-model:value="dayOfWeek" @change="updateIntervalConfig">
            <a-select-option v-for="day in daysOfWeekOptions" :key="day.value" :value="day.value">
              <div class="flex items-center justify-between">
                {{ day.label }}
                <GeneralIcon
                  v-if="dayOfWeek === day.value"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                  icon="ncCheck"
                />
              </div>
            </a-select-option>
          </NcSelect>
          <div class="flex gap-2">
            <NcSelect v-model:value="hourOfDay" @change="updateIntervalConfig">
              <a-select-option v-for="hour in hoursOptions" :key="hour" :value="hour">
                <div class="flex items-center justify-between">
                  {{ hour % 12 || 12 }} {{ hour >= 12 ? 'PM' : 'AM' }}
                  <GeneralIcon v-if="hourOfDay === hour" id="nc-selected-item-icon" class="text-primary w-4 h-4" icon="ncCheck" />
                </div>
              </a-select-option>
            </NcSelect>
            <NcSelect v-model:value="minuteOfHour" @change="updateIntervalConfig">
              <a-select-option v-for="minute in minutesOptions" :key="minute" :value="minute">
                <div class="flex items-center justify-between">
                  {{ minute.toString().padStart(2, '0') }}
                  <GeneralIcon
                    v-if="minuteOfHour === minute"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                    icon="ncCheck"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </div>
        </div>
        <div class="text-xs text-nc-content-gray-muted mt-1">
          Run on {{ daysOfWeekOptions.find((d) => d.value === dayOfWeek)?.label }} at {{ hourOfDay % 12 || 12 }}:{{
            minuteOfHour.toString().padStart(2, '0')
          }}
          {{ hourOfDay >= 12 ? 'PM' : 'AM' }}
        </div>
      </a-form-item>
    </template>

    <!-- Monthly Interval Configuration -->
    <template v-if="intervalType === 'monthly'">
      <a-form-item label="Select time and day of the month">
        <div class="space-y-2">
          <NcSelect v-model:value="dayOfMonth" @change="updateIntervalConfig">
            <a-select-option v-for="day in daysOfMonthOptions" :key="day" :value="day">
              <div class="flex items-center justify-between">
                Day {{ day }}
                <GeneralIcon v-if="dayOfMonth === day" id="nc-selected-item-icon" class="text-primary w-4 h-4" icon="ncCheck" />
              </div>
            </a-select-option>
          </NcSelect>
          <div class="flex gap-2">
            <NcSelect v-model:value="hourOfDay" @change="updateIntervalConfig">
              <a-select-option v-for="hour in hoursOptions" :key="hour" :value="hour">
                <div class="flex items-center justify-between">
                  {{ hour % 12 || 12 }} {{ hour >= 12 ? 'PM' : 'AM' }}
                  <GeneralIcon v-if="hourOfDay === hour" id="nc-selected-item-icon" class="text-primary w-4 h-4" icon="ncCheck" />
                </div>
              </a-select-option>
            </NcSelect>
            <NcSelect v-model:value="minuteOfHour" @change="updateIntervalConfig">
              <a-select-option v-for="minute in minutesOptions" :key="minute" :value="minute">
                <div class="flex items-center justify-between">
                  {{ minute.toString().padStart(2, '0') }}
                  <GeneralIcon
                    v-if="minuteOfHour === minute"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                    icon="ncCheck"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </div>
        </div>
        <div class="text-xs text-nc-content-gray-muted mt-1">
          Run on day {{ dayOfMonth }} at {{ hourOfDay % 12 || 12 }}:{{ minuteOfHour.toString().padStart(2, '0') }}
          {{ hourOfDay >= 12 ? 'PM' : 'AM' }} every month
        </div>
      </a-form-item>
    </template>

    <a-form-item label="Timezone">
      <a-select
        :value="config.timezone"
        show-search
        allow-clear
        :filter-option="(input, option) => antSelectFilterOption(input, option, ['key', 'data-abbreviation'])"
        dropdown-class-name="nc-dropdown-timezone"
        placeholder="Select timezone"
        class="nc-search-timezone"
        @change="onTimezoneChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
        </template>

        <a-select-opt-group label="Suggested">
          <a-select-option
            v-for="timezone of priorityTzs"
            :key="timezone.name"
            :value="timezone.name"
            :data-abbreviation="timezone.abbreviation"
          >
            <div class="flex gap-2 w-full justify-between items-center">
              <span>{{ timezone.name }}</span>
              <div>
                <span class="text-nc-content-gray-muted text-[13px] mr-2">
                  {{ timezone.abbreviation }}
                </span>
                <component
                  :is="iconMap.check"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                  :class="{ invisible: config.timezone !== timezone.name }"
                />
              </div>
            </div>
          </a-select-option>
        </a-select-opt-group>
        <a-select-opt-group label="All">
          <a-select-option
            v-for="timezone of timezones"
            :key="timezone.name"
            :value="timezone.name"
            :data-abbreviation="timezone.abbreviation"
          >
            <div class="flex gap-2 w-full justify-between items-center">
              <span>{{ timezone.name }}</span>
              <div>
                <span class="text-nc-content-gray-muted text-[13px] mr-2">
                  {{ timezone.abbreviation }}
                </span>
                <component
                  :is="iconMap.check"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                  :class="{ invisible: config.timezone !== timezone.name }"
                />
              </div>
            </div>
          </a-select-option>
        </a-select-opt-group>
      </a-select>
      <div class="text-xs text-nc-content-gray-muted mt-1">
        The timezone is used to determine the time of day when the trigger will run.
      </div>
    </a-form-item>
  </a-form>
</template>

<style scoped lang="scss">
:deep(.nc-dropdown-timezone) {
  .ant-select-item-option-content {
    @apply flex items-center justify-between w-full;
  }
}
</style>

<style lang="scss">
.nc-cron-trigger-config {
  .ant-input-number-input {
    &[type='number'] {
      @apply border-0 ring-0;
    }
  }
}
</style>
