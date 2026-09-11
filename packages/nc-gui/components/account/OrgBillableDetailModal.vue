<script setup lang="ts">
defineProps<{
  visible: boolean
  orgId: string
  user: any
}>()

defineEmits(['update:visible'])
</script>

<template>
  <NcSpanHidden />
</template>
