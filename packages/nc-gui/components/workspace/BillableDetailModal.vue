<script setup lang="ts">
// CE stub — billing is EE-only. Full implementation lives in
// ee/components/workspace/BillableDetailModal.vue (resolved by the EE overlay).
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
