<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { useColumn } from '~/composables/useColumn'
import { ColumnInj, EditModeInj, computed, provide, toRef } from '#imports'
import type { Filter } from '~/lib'
import SingleSelect from '~/components/cell/SingleSelect'
import MultiSelect from '~/components/cell/MultiSelect'
import DatePicker from '~/components/cell/DatePicker'
import YearPicker from '~/components/cell/YearPicker'
import Text from '~/components/cell/Text'
import DateTimePicker from '~/components/cell/DateTimePicker'
import TimePicker from '~/components/cell/TimePicker'
import Rating from '~/components/cell/Rating'
import Duration from '~/components/cell/Duration'
import Percent from '~/components/cell/Percent'
import Currency from '~/components/cell/Currency'
import Decimal from '~/components/cell/Decimal'
import Integer from '~/components/cell/Integer'
import Float from '~/components/cell/Float'

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

const types = useColumn(column)
const { isInt, isFloat, isDecimal, isPercent, isBoolean } = types

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

type FilterType = keyof typeof types

const componentMap: Partial<Record<FilterType, any>> = {
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

const filterType = $computed(() => Object.keys(componentMap).find((key) => types[key as FilterType]?.value))
const isNumeric = $computed(() => isPercent.value || isInt.value || isDecimal.value || isFloat.value)
</script>

<template>
  <a-select v-if="isBoolean" v-model:value="filterInput" :disabled="filter.readOnly" :options="booleanOptions"></a-select>
  <div v-else class="bg-white border-1 flex min-w-120px max-w-170px min-h-32px h-full px-2" @mouseup.stop>
    <component
        :is="componentMap[filterType] ?? Text"
        v-model="filterInput"
        :column="column"
        :disabled="filter.readOnly"
        :class="{ 'h-32px': isNumeric }"
    />
  </div>
</template>
