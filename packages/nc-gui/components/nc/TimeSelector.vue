<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  selectedDate?: dayjs.Dayjs | null
  pageDate?: dayjs.Dayjs
  is12hrFormat?: boolean
  isCellInputField?: boolean
  isMinGranularityPicker?: boolean
  minGranularity?: number
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  pageDate: () => dayjs(),
  is12hrFormat: false,
  isCellInputField: false,
  isMinGranularityPicker: false,
  minGranularity: 30,
})
const emit = defineEmits(['update:selectedDate', 'update:pageDate'])

const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const { is12hrFormat, isCellInputField, isMinGranularityPicker, minGranularity } = toRefs(props)

const compareTime = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  if (!date1 || !date2) return false
  return date1.isSame(date2, 'minute') && date1.isSame(date2, 'hour')
}

const handleSelectTime = (time: dayjs.Dayjs) => {
  pageDate.value.set('hour', time.get('hour'))
  pageDate.value.set('minute', time.get('minute'))
  if (!selectedDate.value) {
    selectedDate.value = dayjs()
  }
  selectedDate.value.set('hour', time.get('hour'))
  selectedDate.value.set('minute', time.get('minute'))

  emit('update:pageDate', pageDate.value)
  emit('update:selectedDate', selectedDate.value)
}

const timeOptions = computed(() => {
  return Array.from({ length: is12hrFormat.value ? 12 : 24 }).flatMap((_, h) => {
    return (isMinGranularityPicker.value ? [0, minGranularity.value] : Array.from({ length: 60 })).map((_m, m) => {
      const hour = h.toString().padStart(2, '0')
      const minute = (isMinGranularityPicker.value ? (_m as number) : m).toString().padStart(2, '0')
      const time = dayjs()
      time.set('hour', h)
      time.set('minute', isMinGranularityPicker ? (_m as number) : m)

      return time
    })
  })
})
</script>

<template>
  <div class="flex flex-col">
    <div class="py-1 max-w-[350px]">
      <div v-if="isMinGranularityPicker" class="h-[180px] overflow-y-auto nc-scrollbar-thin">
        <div
          v-for="time of timeOptions"
          :key="time.format('HH:mm')"
          class="hover:bg-gray-200 py-0.5 px-3 text-sm text-gray-600 font-weight-500 text-center cursor-pointer"
          :class="{
            'bg-gray-200': selectedDate && compareTime(time, selectedDate),
          }"
          :data-testid="`time-option-${time.format('HH:mm')}`"
          @click="handleSelectTime(time)"
        >
          {{ time.format('HH:mm') }}
        </div>
      </div>
      <div v-else></div>
      <div class="p-2 box-border border-t-1 border-gray-200 flex items-center justify-center">
        <NcButton :tabindex="-1" class="!h-7" size="small" type="secondary" @click="handleSelectTime(dayjs())">
          <span class="text-small"> {{ $t('general.now') }} </span>
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
