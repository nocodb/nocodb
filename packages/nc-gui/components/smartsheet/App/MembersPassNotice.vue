<script setup lang="ts">
defineProps<{
  app: { id: string; title: string }
  teams: any[]
  rows: any[]
  count?: number
}>()

defineEmits<{
  (event: 'show-them'): void
}>()
</script>

<template><NcSpanHidden /></template>
