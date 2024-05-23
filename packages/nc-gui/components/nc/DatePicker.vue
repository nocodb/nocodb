<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  size?: 'medium'
  selectedDate?: dayjs.Dayjs | null
  pageDate?: dayjs.Dayjs
  isCellInputField?: boolean
  type: 'date' | 'time' | 'year' | 'month'
  isOpen: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  selectedDate: null,
  pageDate: () => dayjs(),
  isCellInputField: false,
  type: 'date',
  isOpen: false,
})
const emit = defineEmits(['update:selectedDate', 'update:pageDate', 'update:selectedWeek'])
// Page date is the date we use to manage which month/date that is currently being displayed
const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const { type, isOpen } = toRefs(props)

const localPageDate = ref()

const localSelectedDate = ref()

const pickerType = ref<Props['type'] | undefined>()

const tempPickerType = computed(() => pickerType.value || type.value)

const localStatePageDate = computed({
  get: () => {
    if (localPageDate.value) {
      return localPageDate.value
    }
    return pageDate.value
  },
  set: (value) => {
    pageDate.value = value
    localPageDate.value = value
    emit('update:pageDate', value)
  },
})

const localStateSelectedDate = computed({
  get: () => {
    if (localSelectedDate.value) {
      return localSelectedDate.value
    }
    return pageDate.value
  },
  set: (value: dayjs.Dayjs) => {
    if (pickerType.value === type.value) {
      pageDate.value = value
      emit('update:selectedDate', value)
      localSelectedDate.value = undefined

      return
    }

    if (type.value === 'date') {
      if (pickerType.value === 'year') {
        localSelectedDate.value = dayjs(localSelectedDate.value ?? selectedDate.value).year(+value.format('YYYY'))
      }
      if (pickerType.value === 'month') {
        localSelectedDate.value = dayjs(localSelectedDate.value ?? selectedDate.value).month(+value.format('MM') - 1)
      }

      localPageDate.value = localSelectedDate.value

      pickerType.value = 'date'
    }
  },
})

watch(isOpen, (next) => {
  if (!next) {
    pickerType.value = type.value
    localPageDate.value = undefined
    localSelectedDate.value = undefined
  }
})

onUnmounted(() => {
  pickerType.value = type.value
  localPageDate.value = undefined
  localSelectedDate.value = undefined
})
</script>

<template>
  <NcDateWeekSelector
    v-if="tempPickerType === 'date'"
    v-model:page-date="localStatePageDate"
    v-model:selected-date="localStateSelectedDate"
    v-model:picker-type="pickerType"
    :is-monday-first="false"
    is-cell-input-field
    size="medium"
  />
  <NcMonthYearSelector
    v-if="['month', 'year'].includes(tempPickerType)"
    v-model:page-date="localStatePageDate"
    v-model:selected-date="localStateSelectedDate"
    v-model:picker-type="pickerType"
    :is-year-picker="tempPickerType === 'year'"
    is-cell-input-field
    size="medium"
  />
</template>

<style lang="scss" scoped></style>
