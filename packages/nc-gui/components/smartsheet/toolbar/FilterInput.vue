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
  storeToRefs,
  toRef,
  useProject,
} from '#imports'
import type { Filter } from '~/lib'
import SingleSelect from '~/components/cell/SingleSelect.vue'
import MultiSelect from '~/components/cell/MultiSelect.vue'
import DatePicker from '~/components/cell/DatePicker.vue'
import YearPicker from '~/components/cell/YearPicker.vue'
import DateTimePicker from '~/components/cell/DateTimePicker.vue'
import TimePicker from '~/components/cell/TimePicker.vue'
import Rating from '~/components/cell/Rating.vue'
import Duration from '~/components/cell/Duration.vue'
import Percent from '~/components/cell/Percent.vue'
import Currency from '~/components/cell/Currency.vue'
import Decimal from '~/components/cell/Decimal.vue'
import Integer from '~/components/cell/Integer.vue'
import Float from '~/components/cell/Float.vue'
import Text from '~/components/cell/Text.vue'

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

// todo: replace with sqlUis
const { sqlUi } = $(storeToRefs(useProject()))

const abstractType = $computed(() => (column.value?.dt && sqlUi ? sqlUi.getAbstractType(column.value) : null))

const checkType = (filterType: FilterType) => {
  const checkTypeFunction = checkTypeFunctions[filterType]

  if (!column.value || !checkTypeFunction) {
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

const componentMap: Partial<Record<FilterType, any>> = $computed(() => {
  return {
    // use MultiSelect for SingleSelect columns for anyof / nanyof filters
    isSingleSelect: ['anyof', 'nanyof'].includes(props.filter.comparison_op!) ? MultiSelect : SingleSelect,
    isMultiSelect: MultiSelect,
    isDate: ['daysAgo', 'daysFromNow', 'pastNumberOfDays', 'nextNumberOfDays'].includes(props.filter.comparison_sub_op!)
      ? Decimal
      : DatePicker,
    isYear: YearPicker,
    isDateTime: ['daysAgo', 'daysFromNow', 'pastNumberOfDays', 'nextNumberOfDays'].includes(props.filter.comparison_sub_op!)
      ? Decimal
      : DateTimePicker,
    isTime: TimePicker,
    isRating: Rating,
    isDuration: Duration,
    isPercent: Percent,
    isCurrency: Currency,
    isDecimal: Decimal,
    isInt: Integer,
    isFloat: Float,
  }
})

const filterType = $computed(() => {
  return Object.keys(componentMap).find((key) => checkType(key as FilterType))
})

const componentProps = $computed(() => {
  switch (filterType) {
    case 'isSingleSelect':
    case 'isMultiSelect': {
      return { disableOptionCreation: true }
    }
    case 'isPercent':
    case 'isDecimal':
    case 'isFloat':
    case 'isInt': {
      return { class: 'h-32px' }
    }
    case 'isDuration': {
      return { showValidationError: false }
    }
    default: {
      return {}
    }
  }
})

const hasExtraPadding = $computed(() => {
  return (
    column.value &&
    (isInt(column.value, abstractType) ||
      isDate(column.value, abstractType) ||
      isDateTime(column.value, abstractType) ||
      isTime(column.value, abstractType) ||
      isYear(column.value, abstractType))
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
  <div
    v-else
    class="bg-white border-1 flex min-w-120px max-w-170px min-h-32px h-full"
    :class="{ 'px-2': hasExtraPadding }"
    @mouseup.stop
  >
    <component
      :is="filterType ? componentMap[filterType] : Text"
      v-model="filterInput"
      :disabled="filter.readOnly"
      placeholder="Enter a value"
      :column="column"
      class="flex"
      v-bind="componentProps"
      location="filter"
    />
  </div>
</template>
