<script setup lang="ts">
const { min = 0 } = defineProps<{
  min?: number
}>()
const vModel = defineModel()

watch(vModel, (val) => {
  if (val === '') vModel.value = min
})
</script>

<template>
  <a-input v-model:value="vModel" type="number" :min="min"></a-input>
</template>
