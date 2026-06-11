<script lang="ts" setup>
defineProps<{
  visible: boolean
  tableId: string
  title?: string
}>()

defineEmits(['update:visible'])
</script>

<template>
  <NcSpanHidden />
</template>
