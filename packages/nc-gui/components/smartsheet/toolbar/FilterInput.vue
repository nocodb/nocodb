<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import SingleSelect from '~/components/cell/SingleSelect/index.vue'
import MultiSelect from '~/components/cell/MultiSelect/index.vue'
import DatePicker from '~/components/cell/Date/index.vue'
import YearPicker from '~/components/cell/Year/index.vue'
import TimePicker from '~/components/cell/Time/index.vue'
import Rating from '~/components/cell/Rating/index.vue'
import Duration from '~/components/cell/Duration/index.vue'
import Percent from '~/components/cell/Percent/index.vue'
import Currency from '~/components/cell/Currency/index.vue'
import Decimal from '~/components/cell/Decimal/index.vue'
import Integer from '~/components/cell/Integer/index.vue'
import Float from '~/components/cell/Float/index.vue'
import Text from '~/components/cell/Text/index.vue'
import User from '~/components/cell/User/index.vue'

interface Props {
  // column could be possibly undefined when the filter is created
  column?: ColumnType
  filter: Filter
  disabled?: boolean
}

interface Emits {
  (event: 'updateFilterValue', model: any): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

const column = toRef(props, 'column')

const editEnabled = ref(true)

const readOnly = ref(props.filter.readOnly || props.disabled)

provide(ColumnInj, column)

provide(EditModeInj, readonly(editEnabled))

provide(ReadonlyInj, readOnly)

const checkTypeFunctions: Record<string, (column: ColumnType, abstractType?: string) => boolean> = {
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
  isReadonlyDateTime,
  isInt,
  isFloat,
  isTextArea,
  isLinks: (col: ColumnType) => col.uidt === UITypes.Links,
  isUser,
  isReadonlyUser,
}

type FilterType = keyof typeof checkTypeFunctions

const { sqlUis } = storeToRefs(useBase())

const sqlUi = ref(
  column.value?.source_id && sqlUis.value[column.value?.source_id]
    ? sqlUis.value[column.value?.source_id]
    : Object.values(sqlUis.value)[0],
)

const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

const checkType = (filterType: FilterType) => {
  const checkTypeFunction = checkTypeFunctions[filterType]

  if (!column.value || !checkTypeFunction) {
    return false
  }

  return checkTypeFunction(column.value, abstractType.value)
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
    isReadonlyDateTime: renderDateFilterInput(props.filter.comparison_sub_op!),
    isTime: TimePicker,
    isRating: Rating,
    isDuration: Duration,
    isPercent: Percent,
    isCurrency: Currency,
    isDecimal: Decimal,
    isInt: Integer,
    isFloat: Float,
    isLinks: Integer,
    isUser: User,
    isReadonlyUser: User,
  }
})

const filterType = computed(() => {
  return Object.keys(componentMap.value).find((key) => checkType(key as FilterType))
})

const componentProps = computed(() => {
  switch (filterType.value) {
    case 'isSingleSelect':
    case 'isMultiSelect': {
      return { disableOptionCreation: true, showReadonlyField: props.filter?.readOnly || props?.disabled }
    }
    case 'isPercent':
    case 'isDecimal':
    case 'isFloat':
    case 'isLinks':
    case 'isInt': {
      return { class: 'h-32px', showReadonlyField: props.filter?.readOnly || props?.disabled }
    }
    case 'isDuration': {
      return { showValidationError: false, showReadonlyField: props.filter?.readOnly || props?.disabled }
    }
    case 'isUser': {
      return { forceMulti: true, showReadonlyField: props.filter?.readOnly || props?.disabled }
    }
    case 'isReadonlyUser': {
      if (['anyof', 'nanyof'].includes(props.filter.comparison_op!)) {
        return { forceMulti: true, showReadonlyField: props.filter?.readOnly || props?.disabled }
      }
      return {}
    }
    case 'isCurrency': {
      return { hidePrefix: true, showReadonlyField: props.filter?.readOnly || props?.disabled }
    }
    case 'isRating': {
      return {
        style: {
          minWidth: `${(column.value?.meta?.max || 5) * 19}px`,
        },
        showReadonlyField: props.filter?.readOnly || props?.disabled,
      }
    }
    default: {
      return { showReadonlyField: props.filter?.readOnly || props?.disabled }
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

const isSingleOrMultiSelect = computed(() => {
  return filterType.value === 'isSingleSelect' || filterType.value === 'isMultiSelect'
})
</script>

<template>
  <a-select
    v-if="column && isBoolean(column, abstractType)"
    v-model:value="filterInput"
    :disabled="filter.readOnly || props.disabled"
    :options="booleanOptions"
  />
  <div
    v-else
    class="bg-white border-1 flex flex-grow min-h-4 h-full px-1 items-center nc-filter-input-wrapper !rounded-lg"
    :class="{ 'px-2': hasExtraPadding, 'border-brand-500': isInputBoxOnFocus, '!max-w-100': isSingleOrMultiSelect }"
    @mouseup.stop
  >
    <component
      :is="filterType ? componentMap[filterType] : Text"
      v-model="filterInput"
      :disabled="filter.readOnly || props.disabled"
      placeholder="Enter a value"
      :column="column"
      class="flex !rounded-lg"
      :class="{
        'text-nc-content-gray-muted pointer-events-none': props.disabled,
      }"
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
