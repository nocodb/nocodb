<script setup lang="ts">
const {
  min = 0,
  max,
  resetTo,
} = defineProps<{
  min?: number
  max?: number
  resetTo?: number
  placeholder?: string
}>()
const vModel = defineModel<string | number>({ required: true })

const inputRef = ref<{ input: HTMLInputElement }>()
const lastSaved = ref()

function onBlur() {
  // triggered by events like focus-out / pressing enter
  // for non-firefox browsers only
  submitValue()
}

function onKeydownEnter() {
  // onBlur is never executed for firefox & safari
  // we use keydown.enter to trigger submitValue
  if (/(Firefox|Safari)/.test(navigator.userAgent)) {
    submitValue()
  }
}

function submitValue() {
  if (vModel.value === '') {
    vModel.value = resetTo ?? min
  } else {
    const numValue = +vModel.value
    if (numValue < min) {
      vModel.value = min
    } else if (max !== undefined && numValue > max) {
      vModel.value = max
    }
  }

  // Only emit save if value actually changed
  if (lastSaved.value !== vModel.value) {
    lastSaved.value = vModel.value
    // You can emit a 'save' event here if needed
    // emit('save')
  }
}

function selectText() {
  if (!inputRef.value) return
  const input = inputRef.value.input
  if (!input) return
  input.select()
}

onMounted(() => {
  lastSaved.value = vModel.value
})
</script>

<template>
  <a-input
    ref="inputRef"
    v-model:value="vModel"
    class="nc-input-sm nc-input-shadow"
    type="number"
    :min="min"
    :max="max"
    :placeholder="placeholder ?? min"
    @blur="onBlur"
    @click="selectText"
    @keydown.enter="onKeydownEnter"
  />
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
