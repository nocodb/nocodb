<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  size?: 'medium'
  selectedDate?: dayjs.Dayjs | null
  pageDate?: dayjs.Dayjs
  isCellInputField?: boolean
  type: 'date' | 'time' | 'year' | 'month'
  isOpen: boolean
  showCurrentDateOption?: boolean | 'disabled'
  isMondayFirst?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  selectedDate: null,
  pageDate: () => dayjs(),
  isCellInputField: false,
  type: 'date',
  isOpen: false,
  isMondayFirst: true,
})
const emit = defineEmits(['update:selectedDate', 'update:pageDate', 'update:selectedWeek', 'currentDate'])
// Page date is the date we use to manage which month/date that is currently being displayed
const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const { type, isOpen } = toRefs(props)

const localPageDate = ref()

const localSelectedDate = ref()

const pickerType = ref<Props['type'] | undefined>()

const pickerStack = ref<Props['type'][]>([])

const tempPickerType = computed(() => pickerType.value || type.value)

const handleUpdatePickerType = (value?: Props['type']) => {
  if (value) {
    pickerType.value = value
    pickerStack.value.push(value)
  } else {
    if (pickerStack.value.length > 1) {
      pickerStack.value.pop()
      const lastPicker = pickerStack.value.pop()
      pickerType.value = lastPicker
    } else {
      pickerStack.value = []
      pickerType.value = type.value
    }
  }
}

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
    if (!value.isValid()) return

    if (pickerType.value === type.value) {
      localPageDate.value = value
      emit('update:selectedDate', value)
      localSelectedDate.value = undefined
      return
    }

    if (['date', 'month'].includes(type.value)) {
      if (pickerType.value === 'year') {
        localSelectedDate.value = dayjs(localPageDate.value ?? localSelectedDate.value ?? selectedDate.value ?? dayjs()).year(
          +value.format('YYYY'),
        )
      }
      if (type.value !== 'month' && pickerType.value === 'month') {
        localSelectedDate.value = dayjs(localPageDate.value ?? localSelectedDate.value ?? selectedDate.value ?? dayjs()).month(
          +value.format('MM') - 1,
        )
      }

      localPageDate.value = localSelectedDate.value

      handleUpdatePickerType()
    }
  },
})

watch(isOpen, (next) => {
  if (!next) {
    pickerType.value = type.value
    localPageDate.value = undefined
    localSelectedDate.value = undefined
    pickerStack.value = []
  }
})

onUnmounted(() => {
  pickerType.value = type.value
  localPageDate.value = undefined
  localSelectedDate.value = undefined
  pickerStack.value = []
})
onMounted(() => {
  localPageDate.value = undefined
  localSelectedDate.value = undefined
  pickerStack.value = []
})
</script>

<template>
  <NcDateWeekSelector
    v-if="tempPickerType === 'date'"
    v-model:page-date="localStatePageDate"
    v-model:selected-date="localStateSelectedDate"
    :picker-type="pickerType"
    :is-monday-first="props.isMondayFirst"
    is-cell-input-field
    size="medium"
    :show-current-date-option="showCurrentDateOption"
    @update:picker-type="handleUpdatePickerType"
    @current-date="emit('currentDate', $event)"
  />
  <NcMonthYearSelector
    v-if="['month', 'year'].includes(tempPickerType)"
    v-model:page-date="localStatePageDate"
    v-model:selected-date="localStateSelectedDate"
    :picker-type="pickerType"
    :is-year-picker="tempPickerType === 'year'"
    is-cell-input-field
    size="medium"
    :show-current-date-option="showCurrentDateOption"
    @update:picker-type="handleUpdatePickerType"
    @current-date="emit('currentDate', $event)"
  />
</template>

<style lang="scss" scoped></style>
