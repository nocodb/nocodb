<script lang="ts" setup>
defineProps<{
  visible: boolean
  docId: string
  title?: string
  parentId?: string | null
}>()

defineEmits(['update:visible'])
</script>

<template>
  <NcSpanHidden />
</template>
