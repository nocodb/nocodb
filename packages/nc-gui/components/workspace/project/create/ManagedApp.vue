<script setup lang="ts">
defineProps<{
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
