<script setup lang="ts">
defineProps<{
  visible: boolean
  workspaceId: string
  user: any
}>()

defineEmits(['update:visible'])
</script>

<template>
  <NcSpanHidden />
</template>
