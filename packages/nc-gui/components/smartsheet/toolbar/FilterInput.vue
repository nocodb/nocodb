<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import {
  ColumnInj,
  EditModeInj,
  ReadonlyInj,
  computed,
  isBoolean,
  isCurrency,
  isDate,
  isDateTime,
  isDecimal,
  isDuration,
  isFloat,
  isInt,
  isMultiSelect,
  isPercent,
  isRating,
  isSingleSelect,
  isTextArea,
  isTime,
  isYear,
  provide,
  ref,
  toRef,
  useProject,
} from '#imports'
import type { Filter } from '~/lib'
import SingleSelect from '~/components/cell/SingleSelect'
import MultiSelect from '~/components/cell/MultiSelect'
import DatePicker from '~/components/cell/DatePicker'
import YearPicker from '~/components/cell/YearPicker'
import DateTimePicker from '~/components/cell/DateTimePicker'
import TimePicker from '~/components/cell/TimePicker'
import Rating from '~/components/cell/Rating'
import Duration from '~/components/cell/Duration'
import Percent from '~/components/cell/Percent'
import Currency from '~/components/cell/Currency'
import Decimal from '~/components/cell/Decimal'
import Integer from '~/components/cell/Integer'
import Float from '~/components/cell/Float'
import Text from '~/components/cell/Text'

interface Props {
  column: ColumnType
  filter: Filter
}

interface Emits {
  (event: 'updateFilterValue', model: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const column = toRef(props, 'column')
const editEnabled = ref(true)

provide(ColumnInj, column)
provide(EditModeInj, readonly(editEnabled))
provide(ReadonlyInj, ref(false))

const checkTypeFunctions = {
  isSingleSelect,
  isMultiSelect,
  isDate,
  isYear,
  isDateTime,
  isTime,
  isRating,
  isDuration,
  isPercent,
  isCurrency,
  isDecimal,
  isInt,
  isFloat,
  isTextArea,
}

type FilterType = keyof typeof checkTypeFunctions

const { sqlUi } = useProject()

const abstractType = $computed(() => column.value && sqlUi.value.getAbstractType(column.value))

const checkType = (type: FilterType) => {
  if (!column.value) {
    return false
  }

  const checkTypeFunction = checkTypeFunctions[type]
  if (!checkTypeFunction) {
    return false
  }
  return checkTypeFunction(column.value, abstractType)
}

const filterInput = computed({
  get: () => {
    return props.filter.value
  },
  set: (value) => {
    emit('updateFilterValue', value)
  },
})

const booleanOptions = [
  { value: true, label: 'true' },
  { value: false, label: 'false' },
  { value: null, label: 'unset' },
]

const componentMap: Partial<Record<FilterType & 'default', any>> = {
  isSingleSelect: SingleSelect,
  isMultiSelect: MultiSelect,
  isDate: DatePicker,
  isYear: YearPicker,
  isDateTime: DateTimePicker,
  isTime: TimePicker,
  isRating: Rating,
  isDuration: Duration,
  isPercent: Percent,
  isCurrency: Currency,
  isDecimal: Decimal,
  isInt: Integer,
  isFloat: Float,
}

const filterType = $computed(() => {
  return Object.keys(componentMap).find((key) => checkType(key as FilterType))
})

const isNumeric = $computed(() => {
  if (!column.value) {
    return false
  }
  return (
    isPercent(column.value) || isInt(column.value, abstractType) || isDecimal(column.value) || isFloat(column.value, abstractType)
  )
})
</script>

<template>
  <a-select
    v-if="column && isBoolean(column, abstractType)"
    v-model:value="filterInput"
    :disabled="filter.readOnly"
    :options="booleanOptions"
  />
  <div v-else class="bg-white border-1 flex min-w-120px max-w-170px min-h-32px h-full px-2" @mouseup.stop>
    <component
      :is="filterType ? componentMap[filterType] : Text"
      v-model="filterInput"
      :disabled="filter.readOnly"
      :column="column"
      :class="{ 'h-32px': isNumeric }"
    />
  </div>
</template>
