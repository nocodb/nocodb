<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { roundUpToPrecision } from 'nocodb-sdk'

interface Props {
  modelValue: number | null | undefined
  placeholder?: string
  hidePrefix?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'save'])

const { showNull } = useGlobal()

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const _vModel = useVModel(props, 'modelValue', emit)

const cellFocused = ref(false)

const inputType = computed(() => (isExpandedFormOpen.value && !cellFocused.value ? 'text' : 'number'))

const vModel = computed({
  get: () => _vModel.value,
  set: (value: unknown) => {
    if (value === '') {
      _vModel.value = null
    } else {
      _vModel.value = value as number
    }
  },
})

const lastSaved = ref()

const currencyMeta = computed(() => {
  return {
    currency_locale: 'en-US',
    currency_code: 'USD',
    precision: 2,
    ...parseProp(column?.value?.meta),
  }
})

const currency = computed(() => {
  try {
    if (vModel.value === null || vModel.value === undefined || isNaN(vModel.value)) {
      return vModel.value
    }

    // Round the value to the specified precision
    const roundedValue = roundUpToPrecision(Number(vModel.value), currencyMeta.value.precision ?? 2)

    return new Intl.NumberFormat(currencyMeta.value.currency_locale || 'en-US', {
      style: 'currency',
      currency: currencyMeta.value.currency_code || 'USD',
      minimumFractionDigits: currencyMeta.value.precision ?? 2,
      maximumFractionDigits: currencyMeta.value.precision ?? 2,
    }).format(roundedValue)
  } catch (e) {
    return vModel.value
  }
})

const focus: VNodeRef = (el) => {
  if (!isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    ;(el as HTMLInputElement)?.focus()
  }

  if (inputType.value === 'number' && !isForm.value) {
    el?.focus()
  }
}

const submitCurrency = () => {
  if (lastSaved.value !== vModel.value) {
    vModel.value = lastSaved.value = vModel.value ?? null
    emit('save')
  }
  editEnabled.value = false
  cellFocused.value = false
}

const onBlur = () => {
  // triggered by events like focus-out / pressing enter
  // for non-firefox browsers only
  submitCurrency()
}

const onFocus = () => {
  cellFocused.value = true
}

const onKeydownEnter = () => {
  // onBlur is never executed for firefox & safari
  // we use keydown.enter to trigger submitCurrency
  if (/(Firefox|Safari)/.test(navigator.userAgent)) {
    submitCurrency()
  }
}

onMounted(() => {
  lastSaved.value = vModel.value
})

const showInputField = computed(
  () => (!readOnly.value && editEnabled.value) || (isForm.value && !isEditColumn.value && editEnabled.value),
)
</script>

<template>
  <div
    v-if="isForm && !isEditColumn && editEnabled && !hidePrefix"
    class="nc-currency-code h-full !bg-gray-100 border-r border-gray-200 px-3 mr-1 flex items-center"
  >
    <span>
      {{ currencyMeta.currency_code }}
    </span>
  </div>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    v-if="showInputField && inputType === 'number'"
    :ref="focus"
    v-model="vModel"
    type="number"
    class="nc-cell-field h-full border-none rounded-md py-1 outline-none focus:outline-none focus:ring-0"
    :class="isForm && !isEditColumn && !hidePrefix ? 'flex flex-1' : 'w-full'"
    :placeholder="placeholder"
    :disabled="readOnly"
    @blur="onBlur"
    @keydown.enter="onKeydownEnter"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
    @contextmenu.stop
  />
  <input
    v-else-if="showInputField"
    :ref="focus"
    :value="currency"
    type="text"
    class="nc-cell-field h-full border-none rounded-md py-1 outline-none focus:outline-none focus:ring-0"
    :class="isForm && !isEditColumn && !hidePrefix ? 'flex flex-1' : 'w-full'"
    :placeholder="placeholder"
    :disabled="readOnly"
    @focus="onFocus"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
    @contextmenu.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>

  <!-- only show the numeric value as previously string value was accepted -->
  <span v-else-if="!isNaN(vModel)" class="nc-cell-field">{{ currency }}</span>

  <!-- possibly unexpected string / null with showNull == false  -->
  <span v-else />
</template>

<style lang="scss" scoped>
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
