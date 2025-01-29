<script setup lang="ts">
const { min = 0 } = defineProps<{
  min?: number
}>()
const vModel = defineModel<string | number>()

function onBlur() {
  if (vModel.value === '') vModel.value = min
}
</script>

<template>
  <a-input v-model:value="vModel" type="number" :min="min" @blur="onBlur"></a-input>
</template>
