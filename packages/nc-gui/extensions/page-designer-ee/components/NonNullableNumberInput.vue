<script setup lang="ts">
const { min = 0, resetTo } = defineProps<{
  min?: number
  resetTo?: number
  placeholder?: string
}>()
const vModel = defineModel<string | number>()

function onBlur() {
  if (vModel.value === '') vModel.value = resetTo ?? min
}
watch(vModel, (val) => {
  if (val && +val < min) vModel.value = min
})
</script>

<template>
  <a-input v-model:value="vModel" type="number" :min="min" :placeholder="placeholder ?? min" @blur="onBlur"></a-input>
</template>
