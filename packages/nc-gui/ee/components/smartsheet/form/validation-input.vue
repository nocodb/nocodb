<script setup lang="ts">
import { AttachmentValidationType, InputType, SelectValidationType, StringValidationType, UITypes } from 'nocodb-sdk'
import type { ColumnType, Validation } from 'nocodb-sdk'

import DatePicker from '~/components/cell/Date/index.vue'
import YearPicker from '~/components/cell/Year/index.vue'
import TimePicker from '~/components/cell/Time/index.vue'
import Duration from '~/components/cell/Duration/index.vue'
import Percent from '~/components/cell/Percent/index.vue'
import Currency from '~/components/cell/Currency/index.vue'
import Decimal from '~/components/cell/Decimal/index.vue'
import Integer from '~/components/cell/Integer/index.vue'
import Float from '~/components/cell/Float/index.vue'
import Text from '~/components/cell/Text/index.vue'
import User from '~/components/cell/User/index.vue'

interface Props {
  column: ColumnType
  validator: Validation
  isCustomValidationInput?: boolean
  placeholder?: string
}

interface Emits {
  (event: 'updateValidationValue', model: any): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

const { column, validator, isCustomValidationInput } = toRefs(props)

const isEditEnabled = computed(() => !!validator.value.type)

provide(ColumnInj, column)

provide(EditModeInj, readonly(isEditEnabled))

provide(ReadonlyInj, ref(false))

const checkTypeFunctions: Record<string, (column: ColumnType, abstractType?: string) => boolean> = {
  isDate: (...props) => isDate(...props) || isDateTime(...props),
  isYear,
  isTime,
  isDuration,
  isPercent,
  isCurrency,
  isDecimal: (col: ColumnType) => {
    return !!(isDecimal(col) || (validator.value.type && validator.value.type === AttachmentValidationType.FileSize))
  },
  isInt: (...props) => {
    return !!(isInt(...props) || (validator.value.type && InputType[validator.value.type] === 'number'))
  },
  isFloat,
  isTextArea,
}

type ValidationType = keyof typeof checkTypeFunctions

const baseStore = useBase()

const sqlUi = computed(() => baseStore.getSqlUiBySourceId(column.value?.source_id))

const abstractType = computed(() => column.value && sqlUi.value.getAbstractType(column.value))

const checkType = (validationType: ValidationType) => {
  const checkTypeFunction = checkTypeFunctions[validationType]

  if (!column.value || !checkTypeFunction) {
    return false
  }

  return checkTypeFunction(column.value, abstractType.value)
}

const isPositiveIntInput = computed(() =>
  [
    StringValidationType.MinLength,
    StringValidationType.MaxLength,
    AttachmentValidationType.FileCount,
    AttachmentValidationType.FileSize,
    SelectValidationType.MinSelected,
    SelectValidationType.MaxSelected,
  ].includes(validator.value.type),
)

const validationInput = computed({
  get: () => {
    const value =
      validator.value.type === StringValidationType.Regex
        ? validator.value.regex
        : AttachmentValidationType.FileTypes && Array.isArray(validator.value.value)
        ? validator.value.value.join(', ')
        : validator.value.value

    if (value && column.value.uidt === UITypes.Attachment && validator.value?.unit === 'MB') {
      return value / 1024
    }

    return value
  },
  set: (value) => {
    if (validator.value.type === AttachmentValidationType.FileTypes) {
      validator.value.value = value ? value.split(',').map((v: string) => v.trim()) : []
      emit('updateValidationValue', value ? value.split(',').map((v: string) => v.trim()) : [])
    } else if (validator.value.type === StringValidationType.Regex) {
      validator.value.regex = value ?? ''
      emit('updateValidationValue', value ?? '')
    } else if (validator.value.value !== null && column.value.uidt === UITypes.Attachment && validator.value?.unit === 'MB') {
      validator.value.value = +(value * 1024).toFixed(4)
      emit('updateValidationValue', +(value * 1024).toFixed(4))
    } else {
      validator.value.value = isPositiveIntInput.value && value < 0 ? -value : value
      emit('updateValidationValue', isPositiveIntInput.value && value < 0 ? -value : value)
    }
  },
})

const updateModelValue = (value) => {
  validationInput.value = value
}

const componentMap: Partial<Record<ValidationType, any>> = computed(() => {
  return {
    isDate: DatePicker,
    isYear: YearPicker,
    isTime: TimePicker,
    isDuration: Duration,
    isPercent: Percent,
    isCurrency: Currency,
    isDecimal: Decimal,
    isInt: Integer,
    isFloat: Float,
    isLinks: Integer,
    isUser: User,
  }
})

const validationType = computed(() => {
  return Object.keys(componentMap.value).find((key) => checkType(key as ValidationType))
})

const componentProps = computed(() => {
  switch (validationType.value) {
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
    case 'isCurrency': {
      return { hidePrefix: true }
    }
    default: {
      return {}
    }
  }
})

const isInputBoxOnFocus = ref(false)

// provide the following to override the default behavior and enable input fields like in form
provide(ActiveCellInj, ref(true))
provide(IsFormInj, ref(true))

const handleKeyDown = (e: KeyboardEvent) => {
  if (isPositiveIntInput.value && e.key === '-') {
    e.preventDefault()
  }
}
</script>

<template>
  <div
    class="flex-1 flex min-h-4 h-full items-stretch nc-validation-input-wrapper text-sm transition-colors overflow-hidden"
    :class="[
      `${validationInput ? 'text-gray-800' : 'text-gray-500'}`,
      {
        'custom-validation-input focus-within:(text-gray-800)': isCustomValidationInput,
        'border-1 !rounded-lg focus-within:(border-brand-500 text-gray-800)': !isCustomValidationInput,
      },
    ]"
    @mouseup.stop
  >
    <div v-if="$slots.prefix" class="min-w-[88px] px-3 border-r-1 border-gray-200 flex items-center">
      <slot name="prefix" />
    </div>

    <div
      class="flex-1 !h-8 flex items-center"
      :class="{
        'bg-gray-50 cursor-not-allowed': !validator.type,
      }"
    >
      <component
        :is="validationType ? componentMap[validationType] : Text"
        :model-value="validationInput"
        :disabled="!validator.type"
        :placeholder="placeholder ? placeholder : isCustomValidationInput ? 'Type value...' : ''"
        :column="column"
        class="flex !rounded-lg !disabled:(bg-gray-50 cursor-not-allowed)"
        style="letter-spacing: normal"
        v-bind="componentProps"
        location="filter"
        :min="isPositiveIntInput ? 0 : undefined"
        @update:model-value="updateModelValue"
        @focus="isInputBoxOnFocus = true"
        @blur="isInputBoxOnFocus = false"
        @keydown="handleKeyDown"
      />
    </div>

    <div v-if="$slots.suffix" class="px-3 border-l-1 border-gray-200 flex items-center">
      <slot name="suffix" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(input) {
  @apply !py-1 !px-2 !text-sm;

  &::placeholder {
    @apply text-gray-500;
  }
}

:deep(.ant-picker) {
  @apply !py-0 !pl-0;
}
.nc-validation-input-wrapper {
  &:not(.custom-validation-input) {
    transition: all 0.3s;
    &:hover {
      @apply border-brand-400;
    }
    &:focus-within {
      @apply shadow-selected;
    }
  }
}
</style>
