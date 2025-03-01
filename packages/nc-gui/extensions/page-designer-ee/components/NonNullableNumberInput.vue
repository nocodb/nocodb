<script setup lang="ts">
const { min = 0, resetTo } = defineProps<{
  min?: number
  resetTo?: number
  placeholder?: string
}>()
const vModel = defineModel<string | number>({ required: true })

const inputRef = ref<{ input: HTMLInputElement }>()

function onBlur() {
  if (vModel.value === '') {
    vModel.value = resetTo ?? min
    return
  }
  if (+vModel.value < min) vModel.value = min
}

function selectText() {
  if (!inputRef.value) return
  const input = inputRef.value.input
  if (!input) return
  input.select()
}
</script>

<template>
  <a-input
    ref="inputRef"
    v-model:value="vModel"
    type="number"
    :min="min"
    :placeholder="placeholder ?? min"
    @blur="onBlur"
    @click="selectText"
  ></a-input>
</template>
