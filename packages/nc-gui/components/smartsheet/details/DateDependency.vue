<script lang="ts" setup>
// CE stub — Date Dependencies is an EE-only feature. The full implementation
// lives in ee/components/smartsheet/details/DateDependency.vue. This stub keeps
// the component resolvable in CE builds, where it never renders.
defineProps<{
  tableId: string
  title?: string
  ganttViewId?: string
  inShell?: boolean
}>()

defineEmits(['saved', 'close'])
</script>

<template>
  <NcSpanHidden />
</template>
