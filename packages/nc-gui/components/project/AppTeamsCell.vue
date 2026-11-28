<script setup lang="ts">
defineProps<{
  user: Record<string, any>
  app: { id: string; title: string }
  teams: any[]
  canManage: boolean
  reason?: string | null
}>()
</script>

<template><NcSpanHidden /></template>
