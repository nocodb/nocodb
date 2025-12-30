<script setup lang="ts">
import { type TimeZone, getTimeZones } from '@vvo/tzdb'
import dayjs from 'dayjs'

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

interface WaitUntilNodeConfig {
  datetime?: string
  timezone?: string
}

const { selectedNodeId, updateNode, selectedNode } = useWorkflowOrThrow()

const browserTzName: string = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const config = computed<WaitUntilNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {}) as WaitUntilNodeConfig
})

// Get user's timezone from config or use browser timezone
const userTimezone = computed(() => config.value.timezone || browserTzName)

const datetime = ref<dayjs.Dayjs | undefined>(
  config.value.datetime
    ? dayjs(config.value.datetime).tz(userTimezone.value)
    : dayjs().tz(userTimezone.value).add(1, 'hour').startOf('hour'),
)

// Flag to prevent watch from firing when we're just changing timezone display
const isChangingTimezone = ref(false)

const open = ref(false)
const isDatePicker = ref(true)
const tempDate = ref<dayjs.Dayjs | undefined>()
const datePickerRef = ref<HTMLInputElement>()
const timePickerRef = ref<HTMLInputElement>()

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

const updateConfig = (updates: Partial<WaitUntilNodeConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
    },
  })
}

watch(datetime, (newDatetime) => {
  if (!selectedNodeId.value || !newDatetime || isChangingTimezone.value) return

  // Interpret the datetime in the selected timezone and convert to UTC
  // The date picker gives us a local datetime, so we need to treat it as being in the selected timezone
  const datetimeInTimezone = dayjs.tz(newDatetime.format('YYYY-MM-DD HH:mm:ss'), userTimezone.value)
  const isoString = datetimeInTimezone.utc().toISOString()

  updateConfig({
    datetime: isoString,
  })
})

const onTimezoneChange = (value: any) => {
  const tzValue = value as string | undefined

  // Keep the same wall-clock time but interpret it in the new timezone
  if (datetime.value) {
    const wallClockTime = datetime.value.format('YYYY-MM-DD HH:mm:ss')
    const datetimeInNewTimezone = dayjs.tz(wallClockTime, tzValue || browserTzName)
    const isoString = datetimeInNewTimezone.utc().toISOString()

    updateConfig({
      timezone: tzValue || undefined,
      datetime: isoString,
    })

    // Update the datetime ref to reflect the new interpretation
    isChangingTimezone.value = true
    datetime.value = datetimeInNewTimezone
    nextTick(() => {
      isChangingTimezone.value = false
    })
  } else {
    updateConfig({ timezone: tzValue || undefined })
  }
}

const description = computed(() => {
  if (!datetime.value) return ''

  const now = dayjs().tz(userTimezone.value)
  const target = datetime.value

  if (target.isBefore(now)) {
    return 'Target time is in the past - workflow will continue immediately'
  }

  const diffMs = target.diff(now)
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `Wait for ${diffDays} day(s) and ${diffHours % 24} hour(s)`
  } else if (diffHours > 0) {
    return `Wait for ${diffHours} hour(s) and ${diffMinutes % 60} minute(s)`
  } else {
    return `Wait for ${diffMinutes} minute(s)`
  }
})

watchEffect(() => {
  if (datetime.value) {
    tempDate.value = datetime.value
  }
})

const handleSelectDate = (value?: dayjs.Dayjs) => {
  if (!value) {
    datetime.value = undefined
    tempDate.value = undefined
    open.value = false
    return
  }

  let dateTime: dayjs.Dayjs
  if (datetime.value) {
    // Keep the existing time, just update the date
    dateTime = dayjs.tz(`${value.format('YYYY-MM-DD')} ${datetime.value.format('HH:mm:ss')}`, userTimezone.value)
  } else {
    // No existing time, use the selected date with 00:00:00
    dateTime = dayjs.tz(value.format('YYYY-MM-DD'), userTimezone.value)
  }

  tempDate.value = dateTime
  datetime.value = dateTime
  open.value = false
}

const handleSelectTime = (value: dayjs.Dayjs) => {
  if (!value || !value.isValid()) return

  let dateTime: dayjs.Dayjs
  if (datetime.value) {
    // Keep the existing date, just update the time
    dateTime = dayjs.tz(`${datetime.value.format('YYYY-MM-DD')} ${value.format('HH:mm:ss')}`, userTimezone.value)
  } else {
    // No existing date, use today's date with the selected time
    dateTime = dayjs.tz(`${dayjs().tz(userTimezone.value).format('YYYY-MM-DD')} ${value.format('HH:mm:ss')}`, userTimezone.value)
  }

  tempDate.value = dateTime
  datetime.value = dateTime
  open.value = false
}

const handleUpdateValue = (e: Event, _isDatePicker: boolean, save = false) => {
  const targetValue = (e.target as HTMLInputElement).value

  if (_isDatePicker) {
    if (!targetValue) {
      tempDate.value = undefined
      return
    }

    if (dayjs(targetValue, 'YYYY-MM-DD').isValid()) {
      const date = dayjs.tz(targetValue, 'YYYY-MM-DD', userTimezone.value)

      if (datetime.value) {
        tempDate.value = dayjs.tz(`${date.format('YYYY-MM-DD')} ${datetime.value.format('HH:mm:ss')}`, userTimezone.value)
      } else {
        tempDate.value = date
      }

      if (save) {
        datetime.value = tempDate.value
      }
    }
  } else {
    if (!targetValue) {
      tempDate.value = datetime.value ? dayjs.tz(datetime.value.format('YYYY-MM-DD'), userTimezone.value) : undefined
      return
    }

    const parsedTime = dayjs(targetValue, 'HH:mm:ss')

    if (parsedTime.isValid()) {
      const timeStr = parsedTime.format('HH:mm:ss')
      tempDate.value = dayjs.tz(
        `${(datetime.value ?? dayjs().tz(userTimezone.value)).format('YYYY-MM-DD')} ${timeStr}`,
        userTimezone.value,
      )

      if (save) {
        datetime.value = tempDate.value
      }
    }
  }
}

const onBlur = (e: Event, _isDatePicker: boolean) => {
  handleUpdateValue(e, _isDatePicker, true)
}

const handleKeydown = (e: KeyboardEvent, _open?: boolean, _isDatePicker = false) => {
  if (e.key !== 'Enter') {
    e.stopPropagation()
  }

  switch (e.key) {
    case 'Enter':
      e.preventDefault()
      e.stopPropagation()

      if (tempDate.value) {
        datetime.value = tempDate.value
      }

      datePickerRef.value?.blur?.()
      timePickerRef.value?.blur?.()
      open.value = false
      return

    case 'Escape':
      open.value = false
      _isDatePicker ? datePickerRef.value?.blur?.() : timePickerRef.value?.blur?.()
      return

    case 'Tab':
      open.value = false
      break
  }
}

const onFocus = (_isDatePicker: boolean) => {
  isDatePicker.value = _isDatePicker
  open.value = true
}

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`

const isOpen = computed(() => open.value)

onClickOutside(datePickerRef, (e) => {
  if ((e.target as HTMLElement)?.closest(`.${randomClass}, .nc-${randomClass}`)) return
  datePickerRef.value?.blur?.()
  timePickerRef.value?.blur?.()
  open.value = false
})

const clickHandler = (_isDatePicker = false) => {
  isDatePicker.value = _isDatePicker
  open.value = true
}

// Auto-set browser timezone on mount if not set
watch(
  () => selectedNode.value,
  (node) => {
    if (!node || !browserTzName) return
    const nodeConfig = (node.data?.config || {}) as WaitUntilNodeConfig
    if (!nodeConfig.timezone) {
      updateNode(selectedNodeId.value, {
        data: {
          ...node.data,
          config: {
            ...nodeConfig,
            timezone: browserTzName,
          },
        },
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <a-form class="nc-wait-until-config" layout="vertical">
    <a-form-item label="Date & Time">
      <NcDropdown
        :visible="isOpen"
        :placement="isDatePicker ? 'bottomLeft' : 'bottomRight'"
        :auto-close="false"
        :trigger="['click']"
        class="nc-cell-picker-datetime w-full"
        :class="`nc-${randomClass}`"
        :overlay-class-name="`${randomClass} nc-picker-datetime ${open ? 'active' : ''} !min-w-[0] overflow-hidden`"
      >
        <div class="nc-date-picker nc-ant-picker-input flex items-center gap-2 w-full !rounded-lg px-2 py-1.5">
          <div class="flex rounded-md box-border w-[60%] max-w-[110px]">
            <input
              ref="datePickerRef"
              :value="datetime?.format('YYYY-MM-DD') ?? ''"
              placeholder="YYYY-MM-DD"
              class="nc-date-input w-full border-none outline-none !text-current !bg-transparent focus:outline-none focus:ring-0"
              @focus="onFocus(true)"
              @blur="onBlur($event, true)"
              @keydown="handleKeydown($event, isOpen, true)"
              @input="handleUpdateValue($event, true)"
              @click.stop="clickHandler(true)"
            />
          </div>
          <div class="rounded-md box-border flex-1">
            <input
              ref="timePickerRef"
              :value="datetime?.format('HH:mm:ss') ?? ''"
              placeholder="HH:mm:ss"
              class="nc-time-input w-full border-none outline-none !text-current !bg-transparent focus:outline-none focus:ring-0"
              @focus="onFocus(false)"
              @blur="onBlur($event, false)"
              @keydown="handleKeydown($event, open)"
              @input="handleUpdateValue($event, false)"
              @click.stop="clickHandler(false)"
            />
          </div>
          <GeneralIcon icon="ncCalendar" class="text-nc-content-gray-subtle flex-none" />
        </div>

        <template #overlay>
          <div
            class="min-w-[120px]"
            :style="{
              width: isDatePicker ? '256px' : '200px',
            }"
          >
            <NcDatePicker
              v-if="isDatePicker"
              v-model:page-date="tempDate"
              :selected-date="datetime ?? null"
              :is-open="isOpen"
              type="date"
              size="medium"
              @update:selected-date="handleSelectDate"
            />

            <NcTimeSelector
              v-else
              :selected-date="datetime ?? null"
              :min-granularity="60"
              is-min-granularity-picker
              :is-open="isOpen"
              @update:selected-date="handleSelectTime"
            />
          </div>
        </template>
      </NcDropdown>

      <div class="text-xs text-nc-content-gray-muted mt-2">
        {{ description }}
      </div>
    </a-form-item>

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
          <a-select-option v-for="tz of priorityTzs" :key="tz.name" :value="tz.name" :data-abbreviation="tz.abbreviation">
            <div class="flex gap-2 w-full justify-between items-center">
              <span>{{ tz.name }}</span>
              <div>
                <span class="text-nc-content-gray-muted text-[13px] mr-2">
                  {{ tz.abbreviation }}
                </span>
                <component
                  :is="iconMap.check"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                  :class="{ invisible: config.timezone !== tz.name }"
                />
              </div>
            </div>
          </a-select-option>
        </a-select-opt-group>
        <a-select-opt-group label="All">
          <a-select-option v-for="tz of timezones" :key="tz.name" :value="tz.name" :data-abbreviation="tz.abbreviation">
            <div class="flex gap-2 w-full justify-between items-center">
              <span>{{ tz.name }}</span>
              <div>
                <span class="text-nc-content-gray-muted text-[13px] mr-2">
                  {{ tz.abbreviation }}
                </span>
                <component
                  :is="iconMap.check"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                  :class="{ invisible: config.timezone !== tz.name }"
                />
              </div>
            </div>
          </a-select-option>
        </a-select-opt-group>
      </a-select>
      <div class="text-xs text-nc-content-gray-muted mt-1">The timezone is used to determine when the workflow will resume.</div>
    </a-form-item>
  </a-form>
</template>

<style scoped lang="scss">
:deep(.nc-dropdown-timezone) {
  .ant-select-item-option-content {
    @apply flex items-center justify-between w-full;
  }
}

.nc-ant-picker-input {
  @apply border-1 border-nc-border-gray-medium;
  &:focus-within {
    @apply shadow-selected border-nc-border-brand;
  }
}

.nc-wait-until-config {
  :deep(.ant-picker) {
    @apply w-full;
  }
}
</style>
