<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ColumnInj,
  IsFormInj,
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
  useBase,
} from '#imports'
import type { Filter } from '#imports'
import SingleSelect from '~/components/cell/SingleSelect.vue'
import MultiSelect from '~/components/cell/MultiSelect.vue'
import DatePicker from '~/components/cell/DatePicker.vue'
import YearPicker from '~/components/cell/YearPicker.vue'
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
  isLinks: (col: ColumnType) => col.uidt === UITypes.Links,
}

type FilterType = keyof typeof checkTypeFunctions

const { sqlUis } = storeToRefs(useBase())

const sqlUi = ref(column.value?.source_id ? sqlUis.value[column.value?.source_id] : Object.values(sqlUis.value)[0])

const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

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

const renderSingleSelect = (op: string) => {
  // use MultiSelect for SingleSelect columns for anyof / nanyof filters
  if (['anyof', 'nanyof'].includes(op)) {
    return MultiSelect
  }
  return SingleSelect
}

const renderDateFilterInput = (sub_op: string) => {
  if (['daysAgo', 'daysFromNow', 'pastNumberOfDays', 'nextNumberOfDays'].includes(sub_op)) {
    return Decimal
  }
  return DatePicker
}

const componentMap: Partial<Record<FilterType, any>> = computed(() => {
  return {
    isSingleSelect: renderSingleSelect(props.filter.comparison_op!),
    isMultiSelect: MultiSelect,
    isDate: renderDateFilterInput(props.filter.comparison_sub_op!),
    isYear: YearPicker,
    isDateTime: renderDateFilterInput(props.filter.comparison_sub_op!),
    isTime: TimePicker,
    isRating: Rating,
    isDuration: Duration,
    isPercent: Percent,
    isCurrency: Currency,
    isDecimal: Decimal,
    isInt: Integer,
    isFloat: Float,
    isLinks: Integer,
  }
})

const filterType = computed(() => {
  return Object.keys(componentMap.value).find((key) => checkType(key as FilterType))
})

const componentProps = computed(() => {
  switch (filterType.value) {
    case 'isSingleSelect':
    case 'isMultiSelect': {
      return { disableOptionCreation: true }
    }
    case 'isPercent':
    case 'isDecimal':
    case 'isFloat':
    case 'isLinks':
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

const hasExtraPadding = computed(() => {
  return (
    column.value &&
    (column.value?.uidt === UITypes.Links ||
      isInt(column.value, abstractType) ||
      isDate(column.value, abstractType) ||
      isDateTime(column.value, abstractType) ||
      isTime(column.value, abstractType) ||
      isYear(column.value, abstractType))
  )
})

const isInputBoxOnFocus = ref(false)

// provide the following to override the default behavior and enable input fields like in form
provide(ActiveCellInj, ref(true))
provide(IsFormInj, ref(true))
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
    class="bg-white border-1 flex flex-grow min-h-4 h-full items-center nc-filter-input-wrapper !rounded-lg"
    :class="{ 'px-2': hasExtraPadding, 'border-brand-500': isInputBoxOnFocus }"
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
      @focus="isInputBoxOnFocus = true"
      @blur="isInputBoxOnFocus = false"
    />
  </div>
</template>

<style lang="scss" scoped>
:deep(input) {
  @apply py-1.5;
}

:deep(.ant-picker) {
  @apply !py-0;
}
</style>
