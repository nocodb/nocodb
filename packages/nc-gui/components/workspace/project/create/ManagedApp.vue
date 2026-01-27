<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  baseId?: string
  title?: string
  subTitle?: string
  alertDescription?: string
  submitButtonText?: string
}>()

defineEmits(['update:visible'])
</script>

<template>
  <NcSpanHidden />
</template>
