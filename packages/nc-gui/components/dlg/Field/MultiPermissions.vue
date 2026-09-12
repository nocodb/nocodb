<script lang="ts" setup>
// CE stub — bulk field permissions is EE-only.
defineProps<{
  visible: boolean
  columns: unknown[]
}>()
defineEmits(['update:visible', 'saved'])
</script>

<template>
  <NcSpanHidden />
</template>
