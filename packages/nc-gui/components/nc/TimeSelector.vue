<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  selectedDate: dayjs.Dayjs | null
  is12hrFormat?: boolean
  isMinGranularityPicker?: boolean
  minGranularity?: number
  isOpen?: boolean
  showCurrentDateOption?: boolean | 'disabled'
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  is12hrFormat: false,
  isMinGranularityPicker: false,
  minGranularity: 30,
  isOpen: false,
})
const emit = defineEmits(['update:selectedDate', 'currentDate'])

const pageDate = ref<dayjs.Dayjs>(dayjs())

const selectedDate = useVModel(props, 'selectedDate', emit)

const { is12hrFormat, isMinGranularityPicker, minGranularity, isOpen } = toRefs(props)

const timeOptionsWrapperRef = ref<HTMLDivElement>()

const compareTime = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  if (!date1 || !date2) return false

  return date1.format('HH:mm') === date2.format('HH:mm')
}

const handleSelectTime = (time: dayjs.Dayjs) => {
  pageDate.value = dayjs().set('hour', time.get('hour')).set('minute', time.get('minute'))

  selectedDate.value = pageDate.value

  //   emit('update:selectedDate', pageDate.value)
}

// TODO: 12hr time format & regular time picker
const timeOptions = computed(() => {
  return Array.from({ length: 24 }).flatMap((_, h) => {
    return (isMinGranularityPicker.value ? [0, minGranularity.value] : Array.from({ length: 60 })).map((_m, m) => {
      const time = dayjs()
        .set('hour', h)
        .set('minute', isMinGranularityPicker.value ? (_m as number) : m)

      return time
    })
  })
})

const handleAutoScroll = (behavior: ScrollBehavior = 'instant') => {
  if (!timeOptionsWrapperRef.value || !selectedDate.value) return

  setTimeout(() => {
    const timeEl = timeOptionsWrapperRef.value?.querySelector(
      `[data-testid="time-option-${selectedDate.value?.format('HH:mm')}"]`,
    )

    timeEl?.scrollIntoView({ behavior, block: 'center' })
  }, 50)
}

watch([selectedDate, isOpen], () => {
  if (timeOptionsWrapperRef.value && isOpen.value && selectedDate.value) {
    handleAutoScroll()
  }
})

onMounted(() => {
  handleAutoScroll()
})
</script>

<template>
  <div class="flex flex-col max-w-[350px]">
    <div v-if="isMinGranularityPicker" ref="timeOptionsWrapperRef" class="h-[180px] overflow-y-auto nc-scrollbar-thin">
      <div
        v-for="time of timeOptions"
        :key="time.format('HH:mm')"
        class="hover:bg-gray-100 py-1 px-3 text-sm text-gray-600 font-weight-500 text-center cursor-pointer"
        :class="{
          'nc-selected bg-gray-100': selectedDate && compareTime(time, selectedDate),
        }"
        :data-testid="`time-option-${time.format('HH:mm')}`"
        @click="handleSelectTime(time)"
      >
        {{ time.format(is12hrFormat ? 'hh:mm A' : 'HH:mm') }}
      </div>
    </div>
    <div v-else></div>
    <div class="px-2 py-1 box-border flex items-center justify-center gap-2">
      <NcButton :tabindex="-1" class="!h-7" size="small" type="secondary" @click="handleSelectTime(dayjs())">
        <span class="text-small"> {{ $t('general.now') }} </span>
      </NcButton>
      <NcTooltip v-if="showCurrentDateOption" :disabled="showCurrentDateOption !== 'disabled'">
        <template #title>
          {{ $t('tooltip.currentDateNotAvail') }}
        </template>
        <NcButton
          class="nc-date-picker-now-btn !h-7"
          size="small"
          type="secondary"
          :disabled="showCurrentDateOption === 'disabled'"
          @click="emit('currentDate')"
        >
          <span class="text-small"> {{ $t('labels.currentDate') }} </span>
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
