<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  type?: 'date' | 'datetime'
  is12hrFormat?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: '',
  disabled: false,
  allowClear: true,
  type: 'datetime',
  is12hrFormat: false,
})

const emit = defineEmits(['update:modelValue'])

const isDateOnly = computed(() => props.type === 'date')

const isOpen = ref(false)

const hourColRef = ref<HTMLDivElement>()
const minColRef = ref<HTMLDivElement>()
const ampmColRef = ref<HTMLDivElement>()

const selectedDate = computed(() => {
  if (!props.modelValue) return null
  const d = dayjs(props.modelValue)
  return d.isValid() ? d : null
})

const dateFormat = 'YYYY-MM-DD'

const timeFormat = computed(() => {
  return props.is12hrFormat ? 'hh:mm A' : 'HH:mm'
})

// Time column data
const hours = computed(() => {
  const count = props.is12hrFormat ? 12 : 24
  return Array.from({ length: count }, (_, i) => (props.is12hrFormat ? i + 1 : i))
})

const minutes = computed(() => Array.from({ length: 60 }, (_, i) => i))

const selectedHour = computed(() => {
  if (!selectedDate.value) return null
  if (props.is12hrFormat) {
    const h = selectedDate.value.hour() % 12
    return h === 0 ? 12 : h
  }
  return selectedDate.value.hour()
})

const selectedMinute = computed(() => selectedDate.value?.minute() ?? null)

const selectedAmPm = computed(() => {
  if (!selectedDate.value) return null
  return selectedDate.value.hour() >= 12 ? 'PM' : 'AM'
})

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function emitValue(date: dayjs.Dayjs) {
  if (!date || !date.isValid()) return

  if (isDateOnly.value) {
    emit('update:modelValue', date.format('YYYY-MM-DD'))
  } else {
    emit('update:modelValue', date.utc().format('YYYY-MM-DD HH:mm:ssZ'))
  }
}

function getBaseDateTime(): dayjs.Dayjs {
  return selectedDate.value ?? dayjs().startOf('day')
}

// --- Date input handling ---
function handleDateInputBlur(e: Event) {
  const value = (e.target as HTMLInputElement).value
  if (!value) {
    emit('update:modelValue', null)
    return
  }
  const parsed = dayjs(value, dateFormat)
  if (parsed.isValid()) {
    const base = getBaseDateTime()
    const dateTime = parsed.hour(base.hour()).minute(base.minute()).second(base.second())
    emitValue(dateTime)
  }
}

// --- Time input handling ---
function handleTimeInputBlur(e: Event) {
  const value = (e.target as HTMLInputElement).value
  if (!value) return

  const fmt = props.is12hrFormat
    ? value
        .trim()
        .toUpperCase()
        .replace(/(AM|PM)$/, ' $1')
        .replace(/\s+/g, ' ')
    : value.trim()

  const parsed = dayjs(fmt, timeFormat.value)
  if (parsed.isValid()) {
    const base = getBaseDateTime()
    const dateTime = base.hour(parsed.hour()).minute(parsed.minute()).second(parsed.second())
    emitValue(dateTime)
  }
}

// --- Picker handlers ---
function handleSelectDate(value?: dayjs.Dayjs) {
  if (!value || !value.isValid()) {
    emit('update:modelValue', null)
    if (isDateOnly.value) isOpen.value = false
    return
  }

  const base = getBaseDateTime()
  const dateTime = value.hour(base.hour()).minute(base.minute()).second(base.second())
  emitValue(dateTime)

  if (isDateOnly.value) {
    isOpen.value = false
  }
}

function handleCurrentDate() {
  emitValue(dayjs())
  nextTick(() => scrollAllToSelected())
}

function handleSelectHour(h: number) {
  const base = getBaseDateTime()
  let hour24 = h

  if (props.is12hrFormat) {
    const isPm = selectedAmPm.value === 'PM'
    if (h === 12) {
      hour24 = isPm ? 12 : 0
    } else {
      hour24 = isPm ? h + 12 : h
    }
  }

  emitValue(base.hour(hour24))
}

function handleSelectMinute(m: number) {
  emitValue(getBaseDateTime().minute(m))
}

function handleSelectAmPm(period: string) {
  const base = getBaseDateTime()
  let h = base.hour()

  if (period === 'AM' && h >= 12) h -= 12
  else if (period === 'PM' && h < 12) h += 12

  emitValue(base.hour(h))
}

function handleClear() {
  emit('update:modelValue', null)
}

// --- Scroll helpers ---
function scrollToSelected(colRef: HTMLDivElement | undefined, behavior: ScrollBehavior = 'instant') {
  if (!colRef) return
  setTimeout(() => {
    const el = colRef.querySelector('.nc-dtp-selected') as HTMLElement
    el?.scrollIntoView({ behavior, block: 'center' })
  }, 50)
}

function scrollAllToSelected() {
  if (isDateOnly.value || !selectedDate.value) return

  scrollToSelected(hourColRef.value)
  scrollToSelected(minColRef.value)
  if (props.is12hrFormat) scrollToSelected(ampmColRef.value)
}

watch(isOpen, (next) => {
  if (next) {
    // Delay to ensure dropdown overlay DOM is rendered
    setTimeout(() => scrollAllToSelected(), 100)
  }
})
</script>

<template>
  <NcDropdown
    v-model:visible="isOpen"
    placement="bottomLeft"
    :auto-close="true"
    :trigger="['click']"
    :disabled="disabled"
    overlay-class-name="nc-date-time-picker-dropdown !min-w-[0] overflow-hidden"
  >
    <!-- Input trigger -->
    <div
      class="nc-date-time-picker-input flex items-center h-8 rounded-lg border-1 border-nc-border-gray-medium px-2 gap-1 transition-colors cursor-pointer"
      :class="{
        'bg-nc-bg-gray-light': disabled,
        'hover:border-nc-border-brand': !disabled,
        'border-nc-border-brand': isOpen && !disabled,
      }"
      data-testid="nc-date-time-picker"
    >
      <GeneralIcon icon="calendar" class="w-4 h-4 text-nc-content-gray-subtle2 flex-none" />

      <!-- Date input -->
      <input
        :value="selectedDate?.format(dateFormat) ?? ''"
        :placeholder="isDateOnly ? placeholder || dateFormat : dateFormat"
        :readonly="disabled"
        class="nc-dtp-date-input flex-1 min-w-0 text-sm bg-transparent border-none outline-none text-nc-content-gray placeholder:text-nc-content-gray-subtle2"
        @blur="handleDateInputBlur"
        @keydown.enter="
          (event) => {
            handleDateInputBlur(event)
            isOpen = false
          }
        "
      />

      <!-- Time input -->
      <template v-if="!isDateOnly">
        <div class="w-px h-4 bg-nc-border-gray-medium flex-none" />

        <GeneralIcon icon="clock" class="w-3.5 h-3.5 text-nc-content-gray-subtle2 flex-none" />

        <input
          :value="selectedDate?.format(timeFormat) ?? ''"
          :placeholder="timeFormat"
          :readonly="disabled"
          class="nc-dtp-time-input flex-none text-sm bg-transparent border-none outline-none text-nc-content-gray placeholder:text-nc-content-gray-subtle2"
          :class="is12hrFormat ? 'w-[72px]' : 'w-[48px]'"
          @blur="handleTimeInputBlur"
          @keydown.enter="
            (event) => {
              handleTimeInputBlur(event)
              isOpen = false
            }
          "
        />
      </template>

      <GeneralIcon
        v-if="allowClear && modelValue && !disabled"
        icon="close"
        class="w-4 h-4 text-nc-content-gray-subtle2 flex-none hover:text-nc-content-gray cursor-pointer"
        @click.stop="handleClear"
      />
    </div>

    <!-- Dropdown overlay -->
    <template #overlay>
      <div class="nc-dtp-dropdown-content flex">
        <!-- Date calendar -->
        <div class="nc-dtp-date-panel w-[256px] flex-none">
          <NcDatePicker
            :selected-date="selectedDate"
            :page-date="selectedDate || undefined"
            :is-open="isOpen"
            type="date"
            size="medium"
            is-cell-input-field
            show-current-date-option
            @update:selected-date="handleSelectDate"
            @current-date="handleCurrentDate"
          />
        </div>

        <!-- Time columns -->
        <div v-if="!isDateOnly" class="nc-dtp-time-panel flex flex-col border-l-1 border-nc-border-gray-medium">
          <!-- Column headers -->
          <div class="flex flex-none border-b-1 border-nc-border-gray-medium h-10 items-center">
            <div class="nc-dtp-col-header w-[46px] text-center text-nc-content-gray-subtle text-sm font-semibold">Hr</div>
            <div class="w-px h-full bg-nc-border-gray-light" />
            <div class="nc-dtp-col-header w-[46px] text-center text-nc-content-gray-subtle text-sm font-semibold">Min</div>
            <template v-if="is12hrFormat">
              <div class="w-px h-full bg-nc-border-gray-light" />
              <div class="nc-dtp-col-header w-[46px] text-center text-xs font-semibold text-nc-content-gray-subtle2" />
            </template>
          </div>

          <!-- Scrollable columns -->
          <div class="flex flex-1 overflow-hidden">
            <!-- Hours -->
            <div ref="hourColRef" class="w-[46px] overflow-y-auto nc-scrollbar-thin">
              <div
                v-for="h of hours"
                :key="h"
                class="nc-dtp-item py-1 text-sm text-nc-content-gray-subtle2 text-center cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                :class="{
                  'nc-dtp-selected bg-nc-bg-gray-dark !font-weight-600': selectedHour === h,
                }"
                @click="handleSelectHour(h)"
              >
                {{ pad(h) }}
              </div>
            </div>

            <div class="w-px bg-nc-border-gray-light" />

            <!-- Minutes -->
            <div ref="minColRef" class="w-[46px] overflow-y-auto nc-scrollbar-thin">
              <div
                v-for="m of minutes"
                :key="m"
                class="nc-dtp-item py-1 text-sm text-nc-content-gray-subtle2 text-center cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                :class="{
                  'nc-dtp-selected bg-nc-bg-gray-dark !font-weight-600': selectedMinute === m,
                }"
                @click="handleSelectMinute(m)"
              >
                {{ pad(m) }}
              </div>
            </div>

            <!-- AM/PM -->
            <template v-if="is12hrFormat">
              <div class="w-px bg-nc-border-gray-light" />
              <div ref="ampmColRef" class="w-[46px] overflow-y-auto nc-scrollbar-thin">
                <div
                  v-for="period of ['AM', 'PM']"
                  :key="period"
                  class="nc-dtp-item py-1 text-sm text-nc-content-gray-subtle2 text-center cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                  :class="{
                    'nc-dtp-selected bg-nc-bg-gray-dark !font-weight-600': selectedAmPm === period,
                  }"
                  @click="handleSelectAmPm(period)"
                >
                  {{ period }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-dtp-dropdown-content {
  // Fixed height so time columns don't grow unbounded
  height: 320px;

  .nc-dtp-date-panel {
    height: 100%;

    :deep(.nc-date-week-header),
    :deep(.nc-month-picker-pagination) {
      border-color: var(--nc-border-gray-medium);
    }
  }

  .nc-dtp-time-panel {
    height: 100%;
  }
}
</style>
